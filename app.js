/**
 * التطبيق الرئيسي لنظام إدارة المصروفات المدرسية
 */

// متغيرات عامة
let currentSection = 'dashboard';
let studentsData = [];
let filteredStudents = [];
let currentUser = null;
let userPermissions = [];

/**
 * تهيئة التطبيق عند تحميل الصفحة
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

/**
 * تهيئة التطبيق
 */
function initializeApp() {
    // التحقق من تسجيل الدخول
    checkLoginStatus();
    
    // تحديث التاريخ الحالي
    updateCurrentDate();
    
    // تحميل بيانات لوحة التحكم
    loadDashboardData();
    
    // تحميل بيانات الطلاب
    loadStudentsData();
    
    // إعداد أحداث النماذج
    setupFormEvents();
    
    // تحميل إعدادات المدرسة مع تأخير للتأكد من جاهزية DOM
    setTimeout(loadSchoolSettings, 500);
    
    console.log('تم تهيئة التطبيق بنجاح');
}

/**
 * تحديث التاريخ الحالي
 */
function updateCurrentDate() {
    const currentDateElement = document.getElementById('current-date');
    if (currentDateElement) {
        const now = new Date();
        const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        };
        currentDateElement.textContent = now.toLocaleDateString('ar-EG', options);
    }
}

/**
 * عرض قسم معين
 */
function showSection(sectionName) {
    // إخفاء جميع الأقسام
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });
    
    // إزالة الكلاس النشط من جميع عناصر التنقل
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // عرض القسم المطلوب
    const targetSection = document.getElementById(sectionName);
    if (targetSection) {
        targetSection.classList.add('active');
    }
    
    // إضافة الكلاس النشط لعنصر التنقل
    const activeNavItem = document.querySelector(`[onclick="showSection('${sectionName}')"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active');
    }
    
    currentSection = sectionName;
    
    // تحميل البيانات الخاصة بالقسم
    switch(sectionName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'students':
            loadStudentsData();
            break;
        case 'fees':
            loadFeesData();
            break;
        case 'reports':
            loadReportsData();
            break;
        case 'settings':
            // تأخير بسيط للتأكد من تحميل العناصر في DOM
            setTimeout(loadSchoolSettings, 100);
            break;
        case 'bus':
            loadBusData();
            break;
    }
}

/**
 * تحميل بيانات لوحة التحكم
 */
function loadDashboardData() {
    const stats = db.getDashboardStats();
    
    // تحديث البطاقات الإحصائية
    document.getElementById('total-students').textContent = stats.totalStudents;
    document.getElementById('total-fees').textContent = formatCurrency(stats.totalFees);
    document.getElementById('paid-fees').textContent = formatCurrency(stats.totalPaid);
    document.getElementById('pending-fees').textContent = formatCurrency(stats.totalPending);
    
    // تحديث إحصائيات المتأخرات
    const overdueFeesElement = document.getElementById('overdue-fees');
    const overdueStudentsElement = document.getElementById('overdue-students');
    
    if (overdueFeesElement) {
        overdueFeesElement.textContent = formatCurrency(stats.totalOverdue || 0);
    }
    
    if (overdueStudentsElement) {
        overdueStudentsElement.textContent = stats.studentsWithOverdue || 0;
    }
}

/**
 * تحميل بيانات الطلاب
 */
function loadStudentsData() {
    studentsData = db.getStudents();
    filteredStudents = [...studentsData];
    displayStudents(filteredStudents);
}

/**
 * عرض قائمة الطلاب في الجدول
 */
function displayStudents(students) {
    const tbody = document.getElementById('students-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 2rem; color: #666;">
                    لا توجد بيانات طلاب
                </td>
            </tr>
        `;
        return;
    }
    
    students.forEach(student => {
        const fees = db.getStudentFees(student.id);
        const payments = db.getStudentPayments(student.id);
        const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
        
        // حساب المبالغ بدقة
        const totalFees = fees ? fees.net_fees : (student.current_fees || 0);
        const remainingAmount = Math.max(0, totalFees - totalPaid);
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${student.student_number}</td>
            <td>${student.name}</td>
            <td>${student.grade}</td>
            <td>${student.phone}</td>
            <td>
                <span class="guardian-type ${student.guardian_type === 'موظف' ? 'employee' : 'non-employee'}">
                    ${student.guardian_type}
                    ${student.guardian_type === 'موظف' && student.employee_name ? `<br><small>${student.employee_name}</small>` : ''}
                </span>
            </td>
            <td>${formatCurrency(totalFees)}</td>
            <td>${formatCurrency(totalPaid)}</td>
            <td>${formatCurrency(remainingAmount)}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-primary btn-sm" onclick="viewStudentDetails(${student.id})" title="عرض التفاصيل">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-warning btn-sm" onclick="editStudent(${student.id})" title="تعديل البيانات">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-info btn-sm" onclick="manageStudent(${student.id})" title="إدارة الطالب">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="btn btn-success btn-sm" onclick="makePayment(${student.id})" title="سداد قسط">
                        <i class="fas fa-money-bill-wave"></i>
                    </button>
                    <button class="btn btn-info btn-sm" onclick="showReceiptPreview(${student.id})" title="معاينة سند">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="printReceipt(${student.id})" title="طباعة سند">
                        <i class="fas fa-print"></i>
                    </button>
                    <button class="btn btn-warning btn-sm" onclick="previewDemandNotice(${student.id})" title="معاينة إشعار مطالبة" ${remainingAmount <= 0 ? 'disabled' : ''}>
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-outline-danger btn-sm" onclick="generateDemandNotice(${student.id})" title="طباعة إشعار مطالبة" ${remainingAmount <= 0 ? 'disabled' : ''}>
                        <i class="fas fa-exclamation-triangle"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteStudent(${student.id})" title="حذف">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * البحث في الطلاب
 */
function searchStudents() {
    const searchTerm = document.getElementById('student-search').value;
    const gradeFilter = document.getElementById('grade-filter').value;
    
    filteredStudents = db.searchStudents(searchTerm, gradeFilter);
    displayStudents(filteredStudents);
}

/**
 * تصفية الطلاب حسب الصف
 */
function filterStudents() {
    searchStudents(); // استخدام نفس منطق البحث
}

/**
 * عرض نافذة إضافة طالب جديد
 */
function showAddStudentModal() {
    const modal = document.getElementById('add-student-modal');
    if (modal) {
        modal.style.display = 'block';
        
        // تعيين تاريخ اليوم كتاريخ أول قسط
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('first-installment-date').value = today;
    }
}

/**
 * إغلاق النافذة المنبثقة
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * تبديل ظهور حقل اسم الموظف
 */
function toggleEmployeeField() {
    const guardianType = document.getElementById('guardian-type').value;
    const employeeGroup = document.getElementById('employee-name-group');
    
    if (guardianType === 'موظف') {
        employeeGroup.style.display = 'block';
        document.getElementById('employee-name').required = true;
    } else {
        employeeGroup.style.display = 'none';
        document.getElementById('employee-name').required = false;
        document.getElementById('employee-name').value = '';
    }
}

/**
 * إعداد أحداث النماذج
 */
function setupFormEvents() {
    // نموذج إضافة طالب جديد
    const addStudentForm = document.getElementById('add-student-form');
    if (addStudentForm) {
        addStudentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleAddStudent();
        });
    }
    
    // نموذج إضافة اشتراك باص
    const busSubscriptionForm = document.getElementById('bus-subscription-form');
    if (busSubscriptionForm) {
        busSubscriptionForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleAddBusSubscription();
        });
    }
    
    // نموذج إعدادات المدرسة
    const schoolSettingsForm = document.getElementById('school-settings-form');
    if (schoolSettingsForm) {
        schoolSettingsForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleSaveSchoolSettings();
        });
    }
    
    // نموذج تعديل الطالب
    const editStudentForm = document.getElementById('edit-student-form');
    if (editStudentForm) {
        editStudentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            handleEditStudent();
        });
    }
    
    // إغلاق نافذة تعديل الطالب
    const editStudentModal = document.getElementById('edit-student-modal');
    if (editStudentModal) {
        const closeBtn = editStudentModal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                closeEditStudentModal();
            });
        }
    }
    
    // إغلاق نافذة إدارة الطالب
    const manageStudentModal = document.getElementById('manage-student-modal');
    if (manageStudentModal) {
        const closeBtn = manageStudentModal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                manageStudentModal.style.display = 'none';
            });
        }
    }
    
    // إغلاق النوافذ المنبثقة عند النقر خارجها
    window.addEventListener('click', function(e) {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    
    // إغلاق النوافذ بالضغط على Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const openModals = document.querySelectorAll('.modal[style*="block"]');
            openModals.forEach(modal => {
                modal.style.display = 'none';
            });
            
            // إغلاق التنبيهات أيضاً
            const alertOverlay = document.getElementById('alert-overlay');
            if (alertOverlay && alertOverlay.style.display === 'block') {
                alertOverlay.style.display = 'none';
            }
        }
    });
}

/**
 * معالجة إضافة طالب جديد
 */
function handleAddStudent() {
    // التحقق من الصلاحية
    if (!requirePermission('add')) {
        return;
    }
    
    const formData = new FormData(document.getElementById('add-student-form'));
    const studentData = {};
    
    // تجميع بيانات النموذج
    const fields = [
        'academic-year', 'student-name', 'student-grade',
        'guardian-type', 'employee-name', 'phone-number',
        'previous-debts', 'current-fees', 'advance-payment',
        'payment-method', 'installments-count', 'first-installment-date',
        'discount-amount', 'discount-reason', 'bus-subscription'
    ];
    
    fields.forEach(field => {
        const element = document.getElementById(field);
        if (element) {
            studentData[field.replace('-', '_')] = element.value;
        }
    });
    
    // تحويل أسماء الحقول لتتطابق مع قاعدة البيانات
    const mappedData = {
        academic_year: studentData.academic_year,
        name: studentData.student_name,
        grade: studentData.student_grade,
        guardian_name: studentData.student_name + ' - ولي الأمر', // قيمة افتراضية
        guardian_type: studentData.guardian_type,
        employee_name: studentData.employee_name,
        phone: studentData.phone_number,
        email: '', // قيمة فارغة
        guardian_relation: 'ولي الأمر', // قيمة افتراضية
        previous_debts: studentData.previous_debts,
        current_fees: studentData.current_fees,
        advance_payment: studentData.advance_payment,
        payment_method: studentData.payment_method,
        installments_count: studentData.installments_count,
        first_installment_date: studentData.first_installment_date,
        discount_amount: studentData.discount_amount,
        discount_reason: studentData.discount_reason,
        bus_subscription: studentData.bus_subscription
    };
    
    // التحقق من صحة البيانات
    if (!validateStudentData(mappedData)) {
        return;
    }
    
    // إضافة الطالب إلى قاعدة البيانات
    const result = db.addStudent(mappedData);
    
    if (result.success) {
        showAlert('تم إضافة الطالب بنجاح', 'success');
        closeModal('add-student-modal');
        document.getElementById('add-student-form').reset();
        loadStudentsData();
        loadDashboardData();
        
        // تسجيل الإجراء
        logStudentAction(result.student.id, 'إضافة طالب', `تم إضافة الطالب ${result.student.name} - الصف ${result.student.grade}`);
    } else {
        showAlert('حدث خطأ في إضافة الطالب: ' + result.error, 'error');
    }
}

/**
 * التحقق من صحة بيانات الطالب
 */
function validateStudentData(data) {
    const requiredFields = [
        { field: 'name', message: 'اسم الطالب مطلوب' },
        { field: 'grade', message: 'الصف الدراسي مطلوب' },
        { field: 'phone', message: 'رقم الهاتف مطلوب' },
        { field: 'current_fees', message: 'الرسوم الدراسية مطلوبة' }
    ];
    
    for (let requirement of requiredFields) {
        if (!data[requirement.field] || data[requirement.field].trim() === '') {
            showAlert(requirement.message, 'error');
            return false;
        }
    }
    
    // التحقق من رقم الهاتف
    const phoneRegex = /^[0-9+\-\s()]+$/;
    if (!phoneRegex.test(data.phone)) {
        showAlert('رقم الهاتف غير صحيح', 'error');
        return false;
    }
    
    // التحقق من المبالغ المالية
    if (parseFloat(data.current_fees) <= 0) {
        showAlert('الرسوم الدراسية يجب أن تكون أكبر من صفر', 'error');
        return false;
    }
    
    return true;
}

/**
 * عرض تفاصيل الطالب
 */
function viewStudentDetails(studentId) {
    const student = db.getStudent(studentId);
    const fees = db.getStudentFees(studentId);
    const payments = db.getStudentPayments(studentId);
    
    if (!student) {
        showAlert('الطالب غير موجود', 'error');
        return;
    }
    
    // إنشاء نافذة تفاصيل الطالب
    const modal = createStudentDetailsModal(student, fees, payments);
    document.body.appendChild(modal);
    modal.style.display = 'block';
}

/**
 * إنشاء نافذة تفاصيل الطالب
 */
function createStudentDetailsModal(student, fees, payments) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'student-details-modal';
    
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="fas fa-user"></i> تفاصيل الطالب</h2>
                <span class="close" onclick="closeAndRemoveModal('student-details-modal')">&times;</span>
            </div>
            <div class="modal-body">
                <div class="student-info">
                    <h3>البيانات الأساسية</h3>
                    <div class="info-grid">
                        <div class="info-item">
                            <label>رقم الطالب:</label>
                            <span>${student.student_number}</span>
                        </div>
                        <div class="info-item">
                            <label>اسم الطالب:</label>
                            <span>${student.name}</span>
                        </div>
                        <div class="info-item">
                            <label>الصف:</label>
                            <span>${student.grade}</span>
                        </div>
                        <div class="info-item">
                            <label>نوع ولي الأمر:</label>
                            <span>${student.guardian_type}</span>
                        </div>
                        <div class="info-item">
                            <label>رقم الهاتف:</label>
                            <span>${student.phone}</span>
                        </div>
                        ${student.employee_name ? `
                        <div class="info-item">
                            <label>اسم الموظف:</label>
                            <span>${student.employee_name}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="fees-info">
                    <h3>الرسوم والأقساط</h3>
                    <div class="fees-summary">
                        <div class="fee-item">
                            <label>إجمالي الرسوم:</label>
                            <span>${formatCurrency(fees ? fees.total_fees : 0)}</span>
                        </div>
                        <div class="fee-item">
                            <label>الخصم:</label>
                            <span>${formatCurrency(fees ? fees.discount_amount : 0)}</span>
                        </div>
                        <div class="fee-item">
                            <label>صافي الرسوم:</label>
                            <span>${formatCurrency(fees ? fees.net_fees : 0)}</span>
                        </div>
                        <div class="fee-item">
                            <label>المبلغ المسدد:</label>
                            <span>${formatCurrency(totalPaid)}</span>
                        </div>
                        <div class="fee-item">
                            <label>المبلغ المتبقي:</label>
                            <span>${formatCurrency(fees ? fees.remaining_amount : 0)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="payments-history">
                    <h3>سجل المدفوعات</h3>
                    <div class="payments-table">
                        ${payments.length > 0 ? `
                            <table class="data-table">
                                <thead>
                                    <tr>
                                        <th>رقم السند</th>
                                        <th>المبلغ</th>
                                        <th>طريقة الدفع</th>
                                        <th>التاريخ</th>
                                        <th>الملاحظات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${payments.map(payment => `
                                        <tr>
                                            <td>${payment.receipt_number}</td>
                                            <td>${formatCurrency(payment.amount)}</td>
                                            <td>${payment.payment_method}</td>
                                            <td>${formatDate(payment.payment_date)}</td>
                                            <td>${payment.notes}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        ` : '<p style="text-align: center; color: #666;">لا توجد مدفوعات مسجلة</p>'}
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="closeAndRemoveModal('student-details-modal')">
                    <i class="fas fa-times"></i>
                    إغلاق
                </button>
                <button type="button" class="btn btn-primary" onclick="makePayment(${student.id})">
                    <i class="fas fa-money-bill-wave"></i>
                    سداد قسط
                </button>
            </div>
        </div>
    `;
    
    return modal;
}

/**
 * سداد قسط للطالب
 */
function makePayment(studentId) {
    const student = db.getStudent(studentId);
    const fees = db.getStudentFees(studentId);
    const payments = db.getStudentPayments(studentId);
    
    if (!student) {
        showAlert('بيانات الطالب غير متوفرة', 'error');
        return;
    }
    
    // حساب المبالغ الفعلية
    const stats = calculateStudentStats(student, fees, payments);
    
    if (stats.remainingAmount <= 0) {
        showAlert('تم سداد جميع المبالغ المستحقة على هذا الطالب', 'success');
        return;
    }
    
    // إنشاء نافذة سداد القسط
    const modal = createPaymentModal(student, stats);
    document.body.appendChild(modal);
    modal.style.display = 'block';
}

/**
 * إنشاء نافذة سداد القسط
 */
function createPaymentModal(student, stats) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'payment-modal';
    
    // حساب قيمة القسط المقترحة
    const suggestedAmount = student.installments_count ? 
        Math.min(stats.totalFees / student.installments_count, stats.remainingAmount) : 
        stats.remainingAmount;
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2><i class="fas fa-money-bill-wave"></i> سداد قسط - ${student.name}</h2>
                <span class="close" onclick="closeAndRemoveModal('payment-modal')">&times;</span>
            </div>
            <form id="payment-form" class="modal-body">
                <div class="payment-info">
                    <div class="info-grid">
                        <div class="info-item">
                            <label>إجمالي الرسوم:</label>
                            <span>${formatCurrency(stats.totalFees)}</span>
                        </div>
                        <div class="info-item">
                            <label>المبلغ المسدد:</label>
                            <span>${formatCurrency(stats.totalPaid)}</span>
                        </div>
                        <div class="info-item">
                            <label>المبلغ المتبقي:</label>
                            <span style="color: #e53e3e; font-weight: bold;">${formatCurrency(stats.remainingAmount)}</span>
                        </div>
                        <div class="info-item">
                            <label>القسط المقترح:</label>
                            <span>${formatCurrency(suggestedAmount)}</span>
                        </div>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label>المبلغ المسدد (الحد الأقصى: ${formatCurrency(stats.remainingAmount)})</label>
                        <input type="number" id="payment-amount" class="form-control" 
                               min="0.001" step="0.001" max="${stats.remainingAmount}" 
                               value="${suggestedAmount}" required>
                    </div>
                    <div class="form-group">
                        <label>طريقة الدفع</label>
                        <select id="payment-method" class="form-control" required>
                            <option value="نقداً">نقداً</option>
                            <option value="بنك">بنك</option>
                            <option value="تحويل">تحويل</option>
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label>ملاحظات</label>
                    <textarea id="payment-notes" class="form-control" rows="3" placeholder="ملاحظات إضافية (اختياري)"></textarea>
                </div>
                
                <input type="hidden" id="student-id" value="${student.id}">
                <input type="hidden" id="max-amount" value="${stats.remainingAmount}">
            </form>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="closeAndRemoveModal('payment-modal')">
                    <i class="fas fa-times"></i>
                    إلغاء
                </button>
                <button type="button" class="btn btn-primary" onclick="processPayment()">
                    <i class="fas fa-save"></i>
                    تأكيد السداد
                </button>
            </div>
        </div>
    `;
    
    return modal;
}

/**
 * معالجة عملية السداد
 */
function processPayment() {
    const studentId = parseInt(document.getElementById('student-id').value);
    const amount = parseFloat(document.getElementById('payment-amount').value);
    const maxAmount = parseFloat(document.getElementById('max-amount').value);
    const paymentMethod = document.getElementById('payment-method').value;
    const notes = document.getElementById('payment-notes').value;
    
    // التحقق من صحة المبلغ
    if (!amount || amount <= 0) {
        showAlert('يرجى إدخال مبلغ صحيح', 'error');
        return;
    }
    
    if (amount > maxAmount) {
        showAlert(`المبلغ المدخل ${formatCurrency(amount)} أكبر من المبلغ المتبقي ${formatCurrency(maxAmount)}`, 'error');
        return;
    }
    
    // التحقق النهائي من المبالغ المتبقية
    const student = db.getStudent(studentId);
    const fees = db.getStudentFees(studentId);
    const payments = db.getStudentPayments(studentId);
    const currentStats = calculateStudentStats(student, fees, payments);
    
    if (amount > currentStats.remainingAmount) {
        showAlert(`لا يمكن دفع ${formatCurrency(amount)} لأن المبلغ المتبقي هو ${formatCurrency(currentStats.remainingAmount)} فقط`, 'error');
        return;
    }
    
    const paymentData = {
        student_id: studentId,
        amount: amount,
        payment_method: paymentMethod,
        payment_type: 'قسط',
        notes: notes || `دفع قسط بمبلغ ${formatCurrency(amount)}`
    };
    
    const result = db.addPayment(paymentData);
    
    if (result.success) {
        showAlert('تم سداد القسط بنجاح', 'success');
        closeAndRemoveModal('payment-modal');
        
        // تسجيل الإجراء
        logStudentAction(studentId, 'سداد قسط', `تم سداد قسط بمبلغ ${formatCurrency(amount)} - ${paymentMethod}`);
        
        // إنشاء وطباعة سند الاستلام
        generateReceipt(result.payment);
        
        // تحديث البيانات
        loadStudentsData();
        loadDashboardData();
    } else {
        showAlert('حدث خطأ في معالجة السداد: ' + result.error, 'error');
    }
}

/**
 * إنشاء سند استلام
 */
function generateReceipt(payment) {
    const student = db.getStudent(payment.student_id);
    const school = db.getSchoolSettings();
    const currentDate = new Date().toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // استخدام شعار المدرسة من البيانات إذا كان متوفراً
    const schoolLogo = school.logo || null;
    console.log('شعار المدرسة في السند:', schoolLogo ? 'متوفر' : 'غير متوفر');
    
    const receiptWindow = window.open('', '_blank');
    receiptWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>سند استلام - ${payment.receipt_number}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                * { box-sizing: border-box; }
                
                body { 
                    font-family: 'Tajawal', Arial, sans-serif; 
                    margin: 0; 
                    padding: 0;
                    background: white;
                    color: #333;
                    line-height: 1.2;
                    font-size: 10px;
                }
                
                .receipt-container {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    max-width: 210mm;
                    margin: 0 auto;
                    margin-left: 10mm;
                    page-break-inside: avoid;
                }
                
                .receipt { 
                    background: white;
                    border: 1px solid #2d3748;
                    border-radius: 4px;
                    padding: 8mm;
                    width: 190mm;
                    height: 125mm;
                    margin: 3mm auto;
                    font-size: 9px;
                    page-break-inside: avoid;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    box-sizing: border-box;
                }
                
                .receipt:first-child {
                    margin-top: 0;
                }
                
                .receipt:last-child {
                    margin-bottom: 0;
                }
                
                .header { 
                    text-align: center;
                    margin-bottom: 8px;
                    border-bottom: 1px solid #4c51bf;
                    padding-bottom: 4px;
                    position: relative;
                }
                
                .school-logo {
                    width: 30px;
                    height: 30px;
                    margin: 0 auto 3px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                }
                
                .school-logo img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                
                .school-logo.default {
                    background: #4c51bf;
                    color: white;
                    font-size: 10px;
                    font-weight: bold;
                }
                
                .school-name { 
                    font-size: 11px;
                    font-weight: bold;
                    color: #2d3748;
                    margin: 2px 0;
                }
                
                .school-info {
                    font-size: 7px;
                    color: #666;
                    margin: 1px 0;
                }
                
                .receipt-title { 
                    font-size: 10px;
                    font-weight: bold;
                    color: #4c51bf;
                    margin: 4px 0;
                }
                
                .receipt-details {
                    display: flex;
                    justify-content: space-between;
                    margin: 4px 0;
                    font-size: 6px;
                }
                
                .receipt-number { 
                    font-size: 8px;
                    font-weight: bold;
                    color: #e53e3e;
                    background: #fed7d7;
                    padding: 1px 4px;
                    border-radius: 6px;
                    display: inline-block;
                }
                
                .content { 
                    margin: 6px 0;
                    background: #f7fafc;
                    padding: 6px;
                    border-radius: 3px;
                    border: 1px solid #e2e8f0;
                    flex: 1;
                }
                
                .row { 
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin: 4px 0;
                    padding: 3px 0;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .row:last-child {
                    border-bottom: none;
                }
                
                .label { 
                    font-weight: bold;
                    color: #4a5568;
                    font-size: 9px;
                    min-width: 60px;
                }
                
                .value {
                    font-size: 9px;
                    color: #2d3748;
                    font-weight: 500;
                }
                
                .amount {
                    font-size: 11px;
                    font-weight: bold;
                    color: #38a169;
                    background: #c6f6d5;
                    padding: 2px 6px;
                    border-radius: 10px;
                    border: 1px solid #38a169;
                }
                
                .amount-words {
                    text-align: center;
                    margin: 6px 0;
                    font-size: 8px;
                    font-weight: bold;
                    color: #4a5568;
                    background: #edf2f7;
                    padding: 4px;
                    border-radius: 3px;
                    border-right: 2px solid #4c51bf;
                }
                
                .footer { 
                    text-align: center;
                    margin-top: 8px;
                    border-top: 1px solid #4c51bf;
                    padding-top: 6px;
                }
                
                .thank-you {
                    font-size: 8px;
                    color: #4c51bf;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                
                .signatures { 
                    display: flex;
                    justify-content: space-between;
                    margin-top: 10px;
                    padding: 0 6px;
                }
                
                .signature { 
                    text-align: center;
                    min-width: 60px;
                }
                
                .signature-title {
                    font-weight: bold;
                    color: #4a5568;
                    margin-bottom: 12px;
                    font-size: 7px;
                }
                
                .signature-line {
                    border-bottom: 1px solid #2d3748;
                    height: 1px;
                    margin-top: 3px;
                }
                
                .print-date {
                    position: absolute;
                    top: 3px;
                    left: 6px;
                    font-size: 6px;
                    color: #666;
                }
                
                .copy-label {
                    position: absolute;
                    top: 3px;
                    right: 6px;
                    font-size: 6px;
                    color: #666;
                    font-weight: bold;
                }
                
                @media print { 
                    * {
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    
                    body { 
                        margin: 0 !important; 
                        padding: 0 !important;
                        background: white !important;
                        font-size: 8px !important;
                    }
                    
                    .receipt-container {
                        width: 210mm !important;
                        margin: 0 auto !important;
                        padding: 0 !important;
                    }
                    
                    .receipt {
                        box-shadow: none !important;
                        border: 1px solid #000 !important;
                        margin: 2mm auto !important;
                        width: 190mm !important;
                        height: 125mm !important;
                        page-break-inside: avoid !important;
                        page-break-after: avoid !important;
                    }
                    
                    .receipt:first-child {
                        margin-top: 0 !important;
                    }
                    
                    .receipt:last-child {
                        margin-bottom: 0 !important;
                    }
                    
                    .print-date, .copy-label {
                        color: #000 !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="receipt-container">
                <!-- النسخة الأولى - نسخة الطالب -->
                <div class="receipt">
                    <div class="print-date">تاريخ الطباعة: ${currentDate}</div>
                    <div class="copy-label">نسخة الطالب</div>
                    
                    <div class="header">
                        <div class="school-logo ${schoolLogo ? '' : 'default'}">
                            ${schoolLogo ? `<img src="${schoolLogo}" alt="شعار المدرسة">` : '🏫'}
                        </div>
                        <div class="school-name">${school.name}</div>
                        <div class="school-info">
                            <div>هاتف: ${school.phone || 'غير محدد'} | العنوان: ${school.address || 'عُمان'}</div>
                            <div>البريد الإلكتروني: ${school.email || 'info@school.om'}</div>
                        </div>
                        <div class="receipt-title">🧾 سند استلام رسوم مدرسية</div>
                        
                        <div class="receipt-details">
                            <div class="receipt-number">رقم السند: ${payment.receipt_number}</div>
                            <div style="font-size: 6px; color: #666;">
                                السنة الدراسية: ${new Date().getFullYear()}/${new Date().getFullYear() + 1}
                            </div>
                        </div>
                    </div>
                    
                    <div class="content">
                        <div class="row">
                            <span class="label">👤 اسم الطالب:</span>
                            <span class="value">${student.name}</span>
                        </div>
                        <div class="row">
                            <span class="label">🎓 الصف الدراسي:</span>
                            <span class="value">${student.grade}</span>
                        </div>
                        <div class="row">
                            <span class="label">👨‍👩‍👧‍👦 ولي الأمر:</span>
                            <span class="value">${student.guardian_type === 'موظف' && student.employee_name ? student.employee_name : student.guardian_type}</span>
                        </div>
                        <div class="row">
                            <span class="label">💰 المبلغ المسدد:</span>
                            <span class="amount">${formatCurrency(payment.amount)}</span>
                        </div>
                        <div class="row">
                            <span class="label">💳 طريقة الدفع:</span>
                            <span class="value">${payment.payment_method}</span>
                        </div>
                        <div class="row">
                            <span class="label">📅 تاريخ السداد:</span>
                            <span class="value">${formatDate(payment.payment_date)}</span>
                        </div>
                        ${payment.notes ? `
                        <div class="row">
                            <span class="label">📝 ملاحظات:</span>
                            <span class="value">${payment.notes}</span>
                        </div>
                        ` : ''}
                        
                        <div class="amount-words">
                            المبلغ بالكلمات: ${convertNumberToArabicWords(payment.amount)} ريال عماني
                        </div>
                    </div>
                    
                    <div class="footer">
                        <div class="thank-you">
                            🌟 شكراً لكم على التزامكم بسداد الرسوم المدرسية في موعدها 🌟
                        </div>
                        
                        <div class="signatures">
                            <div class="signature">
                                <div class="signature-title">توقيع المحاسب</div>
                                <div class="signature-line"></div>
                            </div>
                            <div class="signature">
                                <div class="signature-title">توقيع ولي الأمر</div>
                                <div class="signature-line"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- النسخة الثانية - نسخة الحسابات -->
                <div class="receipt">
                    <div class="print-date">تاريخ الطباعة: ${currentDate}</div>
                    <div class="copy-label">نسخة الحسابات</div>
                    
                    <div class="header">
                        <div class="school-logo ${schoolLogo ? '' : 'default'}">
                            ${schoolLogo ? `<img src="${schoolLogo}" alt="شعار المدرسة">` : '🏫'}
                        </div>
                        <div class="school-name">${school.name}</div>
                        <div class="school-info">
                            <div>هاتف: ${school.phone || 'غير محدد'} | العنوان: ${school.address || 'عُمان'}</div>
                            <div>البريد الإلكتروني: ${school.email || 'info@school.om'}</div>
                        </div>
                        <div class="receipt-title">🧾 سند استلام رسوم مدرسية</div>
                        
                        <div class="receipt-details">
                            <div class="receipt-number">رقم السند: ${payment.receipt_number}</div>
                            <div style="font-size: 6px; color: #666;">
                                السنة الدراسية: ${new Date().getFullYear()}/${new Date().getFullYear() + 1}
                            </div>
                        </div>
                    </div>
                    
                    <div class="content">
                        <div class="row">
                            <span class="label">👤 اسم الطالب:</span>
                            <span class="value">${student.name}</span>
                        </div>
                        <div class="row">
                            <span class="label">🎓 الصف الدراسي:</span>
                            <span class="value">${student.grade}</span>
                        </div>
                        <div class="row">
                            <span class="label">👨‍👩‍👧‍👦 ولي الأمر:</span>
                            <span class="value">${student.guardian_type === 'موظف' && student.employee_name ? student.employee_name : student.guardian_type}</span>
                        </div>
                        <div class="row">
                            <span class="label">💰 المبلغ المسدد:</span>
                            <span class="amount">${formatCurrency(payment.amount)}</span>
                        </div>
                        <div class="row">
                            <span class="label">💳 طريقة الدفع:</span>
                            <span class="value">${payment.payment_method}</span>
                        </div>
                        <div class="row">
                            <span class="label">📅 تاريخ السداد:</span>
                            <span class="value">${formatDate(payment.payment_date)}</span>
                        </div>
                        ${payment.notes ? `
                        <div class="row">
                            <span class="label">📝 ملاحظات:</span>
                            <span class="value">${payment.notes}</span>
                        </div>
                        ` : ''}
                        
                        <div class="amount-words">
                            المبلغ بالكلمات: ${convertNumberToArabicWords(payment.amount)} ريال عماني
                        </div>
                    </div>
                    
                    <div class="footer">
                        <div class="thank-you">
                            🌟 شكراً لكم على التزامكم بسداد الرسوم المدرسية في موعدها 🌟
                        </div>
                        
                        <div class="signatures">
                            <div class="signature">
                                <div class="signature-title">توقيع المحاسب</div>
                                <div class="signature-line"></div>
                            </div>
                            <div class="signature">
                                <div class="signature-title">توقيع ولي الأمر</div>
                                <div class="signature-line"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <script>
                setTimeout(() => {
                    window.print();
                    setTimeout(() => window.close(), 1000);
                }, 500);
            </script>
        </body>
        </html>
    `);
    receiptWindow.document.close();
}

/**
 * تحويل الأرقام إلى كلمات بالعربية
 */
function convertNumberToArabicWords(number) {
    const ones = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
    const tens = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
    const hundreds = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
    
    if (number === 0) return 'صفر';
    if (number < 0) return 'ناقص ' + convertNumberToArabicWords(-number);
    
    let result = '';
    
    // معالجة الآلاف
    if (number >= 1000) {
        const thousands = Math.floor(number / 1000);
        if (thousands === 1) {
            result += 'ألف ';
        } else if (thousands === 2) {
            result += 'ألفان ';
        } else if (thousands < 11) {
            result += convertNumberToArabicWords(thousands) + ' آلاف ';
        } else {
            result += convertNumberToArabicWords(thousands) + ' ألف ';
        }
        number = number % 1000;
    }
    
    // معالجة المئات
    if (number >= 100) {
        const hundredsDigit = Math.floor(number / 100);
        result += hundreds[hundredsDigit] + ' ';
        number = number % 100;
    }
    
    // معالجة العشرات والآحاد
    if (number >= 20) {
        const tensDigit = Math.floor(number / 10);
        const onesDigit = number % 10;
        result += tens[tensDigit];
        if (onesDigit > 0) {
            result += ' و' + ones[onesDigit];
        }
    } else if (number > 0) {
        result += ones[number];
    }
    
    return result.trim();
}

/**
 * إنشاء إشعار مطالبة بالرسوم
 */
function generateDemandNotice(studentId) {
    const student = db.getStudent(studentId);
    const fees = db.getStudentFees(studentId);
    const payments = db.getStudentPayments(studentId);
    const stats = calculateStudentStats(student, fees, payments);
    const school = db.getSchoolSettings();
    
    // حساب الأقساط المتأخرة بناءً على بيانات الطالب
    let overdueInstallments = [];
    if (student.installments_count && student.first_installment_date && stats.totalFees > 0) {
        const installmentAmount = stats.totalFees / student.installments_count;
        const startDate = new Date(student.first_installment_date);
        const today = new Date();
        
        for (let i = 0; i < student.installments_count; i++) {
            const dueDate = new Date(startDate);
            dueDate.setMonth(startDate.getMonth() + i);
            
            if (dueDate < today) {
                const installmentsPaidAmount = (i + 1) * installmentAmount;
                if (stats.totalPaid < installmentsPaidAmount) {
                    overdueInstallments.push({
                        installment_number: i + 1,
                        amount: installmentAmount,
                        due_date: dueDate.toISOString().split('T')[0],
                        status: 'متأخر'
                    });
                }
            }
        }
    }
    
    if (stats.remainingAmount <= 0) {
        showAlert('لا توجد رسوم مستحقة على هذا الطالب', 'info');
        return;
    }
    
    const currentDate = new Date().toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    // استخدام شعار المدرسة من البيانات إذا كان متوفراً
    const schoolLogo = school.logo || null;
    console.log('شعار المدرسة في إشعار المطالبة:', schoolLogo ? 'متوفر' : 'غير متوفر');
    
    const noticeWindow = window.open('', '_blank');
    noticeWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>إشعار مطالبة - ${student.name}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                * { box-sizing: border-box; }
                
                body { 
                    font-family: 'Tajawal', Arial, sans-serif; 
                    margin: 0; 
                    padding: 8px;
                    background: #f8f9fa;
                    color: #333;
                    line-height: 1.4;
                    font-size: 12px;
                }
                
                .notice { 
                    background: white;
                    border: 2px solid #e53e3e;
                    border-radius: 6px;
                    padding: 15px;
                    max-width: 700px;
                    margin: 0 auto;
                    box-shadow: 0 5px 15px rgba(229,62,62,0.1);
                }
                
                .header { 
                    text-align: center;
                    margin-bottom: 15px;
                    border-bottom: 1px solid #e53e3e;
                    padding-bottom: 10px;
                    position: relative;
                }
                
                .school-logo {
                    width: 50px;
                    height: 50px;
                    margin: 0 auto 8px;
                    background: #e53e3e;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 20px;
                    font-weight: bold;
                }
                
                .school-logo img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    border-radius: 50%;
                }
                
                .school-logo.default {
                    background: #e53e3e;
                }
                
                .school-name { 
                    font-size: 18px;
                    font-weight: bold;
                    color: #2d3748;
                    margin: 8px 0;
                }
                
                .notice-title { 
                    font-size: 16px;
                    font-weight: bold;
                    color: #e53e3e;
                    margin: 10px 0;
                    background: #fed7d7;
                    padding: 8px;
                    border-radius: 4px;
                    border: 1px solid #e53e3e;
                }
                
                .urgent-notice {
                    background: #fef5e7;
                    border: 1px solid #ed8936;
                    padding: 8px;
                    border-radius: 4px;
                    margin: 10px 0;
                    text-align: center;
                    font-weight: bold;
                    color: #c05621;
                    font-size: 12px;
                }
                
                .student-info { 
                    margin: 15px 0;
                    background: #f7fafc;
                    padding: 12px;
                    border-radius: 4px;
                    border: 1px solid #e2e8f0;
                }
                
                .row { 
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin: 8px 0;
                    padding: 6px 0;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .row:last-child {
                    border-bottom: none;
                }
                
                .label { 
                    font-weight: bold;
                    color: #4a5568;
                    font-size: 12px;
                    min-width: 100px;
                }
                
                .value {
                    font-size: 12px;
                    color: #2d3748;
                    font-weight: 500;
                }
                
                .amount-due {
                    font-size: 14px;
                    font-weight: bold;
                    color: #e53e3e;
                    background: #fed7d7;
                    padding: 4px 8px;
                    border-radius: 12px;
                    border: 1px solid #e53e3e;
                }
                
                .overdue-amount {
                    font-size: 12px;
                    font-weight: bold;
                    color: #d69e2e;
                    background: #faf089;
                    padding: 3px 6px;
                    border-radius: 10px;
                    border: 1px solid #d69e2e;
                }
                
                .installments-table {
                    margin: 15px 0;
                    border-collapse: collapse;
                    width: 100%;
                    background: white;
                    border-radius: 4px;
                    overflow: hidden;
                    box-shadow: 0 1px 5px rgba(0,0,0,0.1);
                    font-size: 10px;
                }
                
                .installments-table th {
                    background: #e53e3e;
                    color: white;
                    padding: 6px;
                    text-align: center;
                    font-weight: bold;
                    font-size: 10px;
                }
                
                .installments-table td {
                    padding: 4px 6px;
                    text-align: center;
                    border-bottom: 1px solid #e2e8f0;
                    font-size: 10px;
                }
                
                .installments-table tr:nth-child(even) {
                    background: #f8f9fa;
                }
                
                .overdue-row {
                    background: #fed7d7 !important;
                    color: #e53e3e;
                    font-weight: bold;
                }
                
                .notice-text {
                    background: #edf2f7;
                    padding: 12px;
                    border-radius: 4px;
                    border-right: 3px solid #e53e3e;
                    margin: 15px 0;
                    font-size: 11px;
                    line-height: 1.5;
                }
                
                .footer { 
                    text-align: center;
                    margin-top: 20px;
                    border-top: 1px solid #e53e3e;
                    padding-top: 12px;
                }
                
                .contact-info {
                    background: #f7fafc;
                    padding: 8px;
                    border-radius: 4px;
                    margin: 10px 0;
                    border: 1px solid #e2e8f0;
                    font-size: 10px;
                }
                
                .signatures { 
                    display: flex;
                    justify-content: space-between;
                    margin-top: 20px;
                    padding: 0 10px;
                }
                
                .signature { 
                    text-align: center;
                    min-width: 120px;
                }
                
                .signature-title {
                    font-weight: bold;
                    color: #4a5568;
                    margin-bottom: 20px;
                    font-size: 10px;
                }
                
                .signature-line {
                    border-bottom: 1px solid #2d3748;
                    height: 1px;
                    margin-top: 5px;
                }
                
                @media print { 
                    * {
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    
                    body { 
                        margin: 0 !important; 
                        padding: 5px !important;
                        background: white !important;
                        font-size: 10px !important;
                        line-height: 1.2 !important;
                    }
                    
                    .notice {
                        box-shadow: none !important;
                        border: 1px solid #000 !important;
                        padding: 8px !important;
                        margin: 0 !important;
                        max-width: none !important;
                        width: 100% !important;
                        page-break-inside: avoid !important;
                    }
                    
                    .header {
                        margin-bottom: 8px !important;
                        padding-bottom: 5px !important;
                    }
                    
                    .student-info {
                        margin: 8px 0 !important;
                        padding: 6px !important;
                    }
                    
                    .notice-text {
                        margin: 8px 0 !important;
                        padding: 6px !important;
                        font-size: 9px !important;
                    }
                    
                    .installments-table {
                        margin: 8px 0 !important;
                        font-size: 8px !important;
                    }
                    
                    .installments-table th,
                    .installments-table td {
                        padding: 2px 4px !important;
                        font-size: 8px !important;
                    }
                    
                    .footer {
                        margin-top: 10px !important;
                        padding-top: 5px !important;
                    }
                    
                    .signatures {
                        margin-top: 10px !important;
                    }
                    
                    .signature-title {
                        margin-bottom: 10px !important;
                        font-size: 8px !important;
                    }
                }
            </style>
        </head>
        <body>
            <div class="notice">
                <div class="header">
                    <div class="school-logo ${schoolLogo ? '' : 'default'}">
                        ${schoolLogo ? `<img src="${schoolLogo}" alt="شعار المدرسة">` : '⚠️'}
                    </div>
                    <div class="school-name">${school.name}</div>
                    <div class="notice-title">📢 إشعار مطالبة بالرسوم المدرسية</div>
                </div>
                
                ${overdueInstallments.length > 0 ? `
                <div class="urgent-notice">
                    🚨 تنبيه هام: يوجد أقساط متأخرة عن موعد الاستحقاق 🚨
                </div>
                ` : ''}
                
                <div class="student-info">
                    <div class="row">
                        <span class="label">👤 اسم الطالب:</span>
                        <span class="value">${student.name}</span>
                    </div>
                    <div class="row">
                        <span class="label">🎓 الصف الدراسي:</span>
                        <span class="value">${student.grade}</span>
                    </div>
                    <div class="row">
                        <span class="label">👨‍👩‍👧‍👦 ولي الأمر:</span>
                        <span class="value">${student.guardian_type === 'موظف' && student.employee_name ? student.employee_name : student.guardian_type}</span>
                    </div>
                    <div class="row">
                        <span class="label">💰 إجمالي الرسوم:</span>
                        <span class="value">${formatCurrency(stats.totalFees)}</span>
                    </div>
                    <div class="row">
                    <span class="label">✅ المبلغ المسدد:</span>
                    <span class="value">${formatCurrency(stats.totalPaid)}</span>
                    </div>
                    <div class="row">
                        <span class="label">⏳ المبلغ المتبقي:</span>
                        <span class="amount-due">${formatCurrency(stats.remainingAmount)}</span>
                    </div>
                    ${stats.overdueAmount > 0 ? `
                    <div class="row">
                        <span class="label">⚠️ المبلغ المتأخر:</span>
                        <span class="overdue-amount">${formatCurrency(stats.overdueAmount)}</span>
                    </div>
                    ` : ''}
                </div>
                
                ${overdueInstallments.length > 0 ? `
                <h3 style="color: #e53e3e; text-align: center; margin: 15px 0; font-size: 14px;">الأقساط المتأخرة</h3>
                <table class="installments-table">
                    <thead>
                        <tr>
                            <th>رقم القسط</th>
                            <th>المبلغ</th>
                            <th>تاريخ الاستحقاق</th>
                            <th>الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${overdueInstallments.map(installment => {
                            return `
                                <tr class="overdue-row">
                                    <td>${installment.installment_number}</td>
                                    <td>${formatCurrency(installment.amount)}</td>
                                    <td>${formatDate(installment.due_date)}</td>
                                    <td>🚨 ${installment.status}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
                ` : ''}
                
                <div class="notice-text">
                    <strong>السيد/ة المحترم/ة ولي أمر الطالب/ة: ${student.name}</strong><br><br>
                    
                    تحية طيبة وبعد،<br><br>
                    
                    نتشرف بإحاطتكم علماً بأن هناك رسوم مدرسية مستحقة على الطالب/ة المذكور/ة أعلاه بمبلغ 
                    <strong style="color: #e53e3e;">${formatCurrency(stats.remainingAmount)}</strong> 
                    (${convertNumberToArabicWords(Math.floor(stats.remainingAmount))} ريال عماني).
                    <br><br>
                    
                    ${overdueInstallments.length > 0 ? `
                    <span style="color: #d69e2e; font-weight: bold;">
                    ⚠️ نلفت انتباهكم إلى وجود أقساط متأخرة عن موعد الاستحقاق بمبلغ ${formatCurrency(stats.overdueAmount)} ريال عماني.
                    </span><br><br>
                    ` : ''}
                    
                    نرجو منكم التكرم بسداد المبلغ المستحق في أقرب وقت ممكن، وذلك لضمان استمرارية الخدمات التعليمية المقدمة لأبنائكم الطلبة.
                    <br><br>
                    
                    <strong>طرق السداد المتاحة:</strong><br>
                    • نقداً في مكتب الشؤون المالية بالمدرسة<br>
                    • تحويل بنكي على حساب المدرسة<br>
                    • شيك مصرفي باسم المدرسة<br><br>
                    
                    شاكرين لكم تعاونكم الدائم، ونتطلع إلى استمرار شراكتنا في تعليم أبنائكم.
                </div>
                
                <div class="contact-info">
                    <h4 style="color: #4c51bf; margin-bottom: 15px;">معلومات التواصل:</h4>
                    <div><strong>الهاتف:</strong> ${school.phone || 'غير محدد'}</div>
                    <div><strong>البريد الإلكتروني:</strong> ${school.email || 'info@school.om'}</div>
                    <div><strong>العنوان:</strong> ${school.address || 'سلطنة عُمان'}</div>
                </div>
                
                <div class="footer">
                    <div class="signatures">
                        <div class="signature">
                            <div class="signature-title">المدير المالي</div>
                            <div class="signature-line"></div>
                        </div>
                        <div class="signature">
                            <div class="signature-title">مدير المدرسة</div>
                            <div class="signature-line"></div>
                        </div>
                    </div>
                    
                    <div style="margin-top: 15px; font-size: 9px; color: #666;">
                        تاريخ الإشعار: ${currentDate} • السنة الدراسية: ${new Date().getFullYear()}/${new Date().getFullYear() + 1}
                    </div>
                </div>
            </div>
            <script>
                setTimeout(() => {
                    window.print();
                    setTimeout(() => window.close(), 1000);
                }, 500);
            </script>
        </body>
        </html>
    `);
    noticeWindow.document.close();
}

/**
 * طباعة سند لطالب
 */
function printReceipt(studentId) {
    const payments = db.getStudentPayments(studentId);
    
    if (payments.length === 0) {
        showAlert('لا توجد مدفوعات لهذا الطالب', 'warning');
        return;
    }
    
    // طباعة آخر دفعة
    const lastPayment = payments[payments.length - 1];
    generateReceipt(lastPayment);
}

/**
 * حذف طالب
 */
function deleteStudent(studentId) {
    // التحقق من الصلاحية
    if (!requirePermission('delete')) {
        return;
    }
    
    const student = db.getStudent(studentId);
    
    if (!student) {
        showAlert('الطالب غير موجود', 'error');
        return;
    }
    
    if (confirm(`هل أنت متأكد من حذف الطالب "${student.name}"؟\nسيتم حذف جميع البيانات المرتبطة بالطالب نهائياً.`)) {
        const result = db.deleteStudent(studentId);
        
        if (result.success) {
            showAlert('تم حذف الطالب بنجاح', 'success');
            loadStudentsData();
            loadDashboardData();
            
            // تسجيل الإجراء
            logStudentAction(studentId, 'حذف طالب', `تم حذف الطالب ${student.name} - الصف ${student.grade}`);
        } else {
            showAlert('حدث خطأ في حذف الطالب: ' + result.error, 'error');
        }
    }
}

/**
 * تحميل نموذج Excel فارغ للتعبئة
 */
function downloadExcelTemplate() {
    try {
        // إنشاء workbook جديد
        const wb = XLSX.utils.book_new();
        
        // تعريف أعمدة النموذج
        const headers = [
            'اسم الطالب',
            'الصف الدراسي',
            'نوع ولي الأمر',
            'اسم الموظف',
            'رقم الهاتف',
            'ديون الأعوام السابقة',
            'الرسوم الدراسية الحالية',
            'المبلغ المقدم',
            'طريقة الدفع',
            'عدد الأقساط',
            'تاريخ أول قسط',
            'قيمة الخصم',
            'سبب الخصم',
            'اشتراك الباص'
        ];
        
        // إنشاء صف العناوين
        const headerRow = headers.map(header => ({ v: header, t: 's' }));
        
        // إضافة صفوف أمثلة للتوضيح
        const exampleRows = [
            [
                'أحمد محمد الكندي',
                'الثالث',
                'غير موظف',
                '',
                '+968 91234567',
                '0.000',
                '400.000',
                '120.000',
                'نقداً',
                '3',
                '2024-09-01',
                '40.000',
                'ابن موظف',
                'نعم'
            ],
            [
                'فاطمة سالم البوسعيدية',
                'الرابع',
                'موظف',
                'سالم البوسعيدي',
                '+968 91111111',
                '80.000',
                '480.000',
                '200.000',
                'بنك',
                '4',
                '2024-09-15',
                '60.000',
                'ابن موظف',
                'نعم'
            ]
        ];
        
        // تحويل البيانات إلى worksheet
        const wsData = [headers, ...exampleRows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        // تحسين عرض الأعمدة
        const colWidths = headers.map(() => ({ width: 20 }));
        ws['!cols'] = colWidths;
        
        // إضافة تعليمات في صف منفصل
        const instructionSheet = XLSX.utils.aoa_to_sheet([
            ['تعليمات استخدام النموذج:'],
            ['1. املأ بيانات الطلاب في الصفوف أسفل العناوين'],
            ['2. احذف الصفوف المثالية قبل الاستيراد'],
            ['3. تأكد من صحة البيانات في كل عمود'],
            ['4. الصفوف الدراسية المتاحة: تمهيدي، الأول، الثاني، الثالث، الرابع، الخامس، السادس، السابع، الثامن، التاسع، العاشر، الحادي عشر، الثاني عشر'],
            ['5. نوع ولي الأمر: موظف أو غير موظف'],
            ['6. اسم الموظف: يُملأ فقط إذا كان ولي الأمر موظف في المدرسة'],
            ['7. طريقة الدفع: نقداً، بنك، تحويل'],
            ['8. سبب الخصم: ابن موظف، ابن معلم، مجتهد دراسياً، منحة، مبلغ كاش، أخرى'],
            ['9. اشتراك الباص: نعم أو لا'],
            ['10. المبالغ يجب أن تكون بالريال العُماني (3 أرقام عشرية)'],
            ['11. تم حذف حقول: اسم ولي الأمر، البريد الإلكتروني، صلة ولي الأمر لتبسيط العملية']
        ]);
        
        // إضافة الصفحات إلى الكتاب
        XLSX.utils.book_append_sheet(wb, ws, 'بيانات الطلاب');
        XLSX.utils.book_append_sheet(wb, instructionSheet, 'التعليمات');
        
        // تحميل الملف
        const fileName = `نموذج_بيانات_الطلاب_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showAlert('تم تحميل نموذج Excel بنجاح', 'success');
    } catch (error) {
        console.error('خطأ في إنشاء نموذج Excel:', error);
        showAlert('حدث خطأ في إنشاء نموذج Excel', 'error');
    }
}

/**
 * استيراد الطلاب من ملف Excel
 */
function importStudentsFromExcel() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // قراءة الصفحة الأولى
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    
                    // تحويل إلى JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    if (jsonData.length < 2) {
                        showAlert('الملف فارغ أو لا يحتوي على بيانات كافية', 'error');
                        return;
                    }
                    
                    // معالجة البيانات
                    const headers = jsonData[0];
                    const rows = jsonData.slice(1);
                    
                    let successCount = 0;
                    let errorCount = 0;
                    const errors = [];
                    
                    rows.forEach((row, index) => {
                        // تخطي الصفوف الفارغة
                        if (!row || row.length === 0 || !row[0]) {
                            return;
                        }
                        
                        try {
                            const studentData = {
                                academic_year: '2024-2025',
                                name: row[0] || '',
                                grade: row[1] || '',
                                guardian_name: (row[0] || 'طالب') + ' - ولي الأمر', // قيمة افتراضية
                                guardian_type: row[2] || 'غير موظف',
                                employee_name: row[3] || '',
                                phone: row[4] || '',
                                email: '', // قيمة فارغة
                                guardian_relation: 'ولي الأمر', // قيمة افتراضية
                                previous_debts: parseFloat(row[5]) || 0,
                                current_fees: parseFloat(row[6]) || 0,
                                advance_payment: parseFloat(row[7]) || 0,
                                payment_method: row[8] || 'نقداً',
                                installments_count: parseInt(row[9]) || 1,
                                first_installment_date: row[10] || new Date().toISOString().split('T')[0],
                                discount_amount: parseFloat(row[11]) || 0,
                                discount_reason: row[12] || '',
                                bus_subscription: row[13] || 'لا'
                            };
                            
                            // التحقق من البيانات الأساسية
                            if (!studentData.name || !studentData.grade || !studentData.guardian_name) {
                                errors.push(`الصف ${index + 2}: بيانات أساسية مفقودة`);
                                errorCount++;
                                return;
                            }
                            
                            const result = db.addStudent(studentData);
                            if (result.success) {
                                successCount++;
                            } else {
                                errors.push(`الصف ${index + 2}: ${result.error}`);
                                errorCount++;
                            }
                        } catch (error) {
                            errors.push(`الصف ${index + 2}: خطأ في معالجة البيانات`);
                            errorCount++;
                        }
                    });
                    
                    // عرض النتائج
                    let message = `تم استيراد ${successCount} طالب بنجاح`;
                    if (errorCount > 0) {
                        message += `\nفشل في ${errorCount} طالب`;
                        console.log('أخطاء الاستيراد:', errors);
                    }
                    
                    if (successCount > 0) {
                        showAlert(message, 'success');
                        loadStudentsData();
                        loadDashboardData();
                    } else {
                        showAlert('لم يتم استيراد أي طالب. تحقق من صحة البيانات', 'error');
                    }
                    
                } catch (error) {
                    console.error('خطأ في قراءة ملف Excel:', error);
                    showAlert('حدث خطأ في قراءة ملف Excel. تأكد من صحة الملف', 'error');
                }
            };
            reader.readAsArrayBuffer(file);
        }
    };
    
    input.click();
}

/**
 * تصدير الطلاب إلى ملف Excel
 */
function exportStudentsToExcel() {
    try {
        const students = db.getStudents();
        const fees = db.getFees();
        
        if (students.length === 0) {
            showAlert('لا توجد بيانات طلاب للتصدير', 'warning');
            return;
        }
        
        // إعداد بيانات التصدير
        const exportData = students.map(student => {
            const studentFees = fees.find(fee => fee.student_id === student.id);
            const payments = db.getStudentPayments(student.id);
            const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
            
            return {
                'رقم الطالب': student.student_number,
                'اسم الطالب': student.name,
                'الصف الدراسي': student.grade,
                'نوع ولي الأمر': student.guardian_type,
                'اسم الموظف': student.employee_name || '',
                'رقم الهاتف': student.phone,
                'ديون سابقة': student.previous_debts.toFixed(3),
                'الرسوم الحالية': student.current_fees.toFixed(3),
                'إجمالي الرسوم': studentFees ? studentFees.total_fees.toFixed(3) : '0.000',
                'قيمة الخصم': student.discount_amount.toFixed(3),
                'سبب الخصم': student.discount_reason || '',
                'صافي الرسوم': studentFees ? studentFees.net_fees.toFixed(3) : '0.000',
                'المبلغ المقدم': student.advance_payment.toFixed(3),
                'إجمالي المسدد': totalPaid.toFixed(3),
                'المبلغ المتبقي': studentFees ? studentFees.remaining_amount.toFixed(3) : '0.000',
                'عدد الأقساط': student.installments_count,
                'طريقة الدفع': student.payment_method,
                'تاريخ أول قسط': student.first_installment_date,
                'اشتراك الباص': student.bus_subscription ? 'نعم' : 'لا',
                'تاريخ التسجيل': formatDate(student.created_at),
                'حالة السداد': studentFees ? studentFees.status : 'غير محدد'
            };
        });
        
        // إنشاء workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // تحسين عرض الأعمدة
        const colWidths = Object.keys(exportData[0]).map(() => ({ width: 18 }));
        ws['!cols'] = colWidths;
        
        // إضافة صفحة البيانات
        XLSX.utils.book_append_sheet(wb, ws, 'بيانات الطلاب');
        
        // إضافة صفحة الإحصائيات
        const stats = db.getDashboardStats();
        const statsData = [
            ['الإحصائيات العامة', ''],
            ['إجمالي عدد الطلاب', students.length],
            ['إجمالي الرسوم', stats.totalFees.toFixed(3) + ' ر.ع'],
            ['المبالغ المسددة', stats.totalPaid.toFixed(3) + ' ر.ع'],
            ['المبالغ المعلقة', stats.totalPending.toFixed(3) + ' ر.ع'],
            ['تاريخ التصدير', new Date().toLocaleDateString('ar-EG')],
            ['وقت التصدير', new Date().toLocaleTimeString('ar-EG')]
        ];
        
        const statsWs = XLSX.utils.aoa_to_sheet(statsData);
        XLSX.utils.book_append_sheet(wb, statsWs, 'الإحصائيات');
        
        // تحميل الملف
        const fileName = `بيانات_الطلاب_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showAlert('تم تصدير البيانات إلى Excel بنجاح', 'success');
        
    } catch (error) {
        console.error('خطأ في تصدير البيانات:', error);
        showAlert('حدث خطأ في تصدير البيانات إلى Excel', 'error');
    }
}

/**
 * تحميل بيانات الرسوم
 */
function loadFeesData() {
    const stats = db.getDashboardStats();
    
    document.getElementById('fees-total').textContent = formatCurrency(stats.totalFees);
    document.getElementById('fees-paid').textContent = formatCurrency(stats.totalPaid);
    document.getElementById('fees-pending').textContent = formatCurrency(stats.totalPending);
}

/**
 * تحميل بيانات التقارير
 */
function loadReportsData() {
    // يمكن إضافة المزيد من المنطق هنا
    console.log('تم تحميل بيانات التقارير');
}

/**
 * تحميل إعدادات المدرسة
 */
function loadSchoolSettings() {
    try {
        const settings = db.getSchoolSettings();
        console.log('تحميل إعدادات المدرسة:', settings);
        
        if (settings) {
            const schoolNameInput = document.getElementById('school-name');
            const schoolPhoneInput = document.getElementById('school-phone');
            const schoolDirectorInput = document.getElementById('school-director');
            const logoPreview = document.getElementById('logo-preview');
            
            if (schoolNameInput) {
                schoolNameInput.value = settings.name || '';
                console.log('تم تحميل اسم المدرسة:', settings.name);
            }
            if (schoolPhoneInput) {
                schoolPhoneInput.value = settings.phone || '';
                console.log('تم تحميل رقم الهاتف:', settings.phone);
            }
            if (schoolDirectorInput) {
                schoolDirectorInput.value = settings.director || '';
                console.log('تم تحميل اسم المدير:', settings.director);
            }
            
            // عرض الشعار المحفوظ إذا وُجد
            if (logoPreview) {
                if (settings.logo) {
                    logoPreview.innerHTML = `<img src="${settings.logo}" alt="شعار المدرسة" style="max-width: 100px; max-height: 100px; border-radius: 5px;">`;
                    console.log('تم تحميل الشعار المحفوظ');
                } else {
                    logoPreview.innerHTML = '<p style="color: #666;">لم يتم رفع شعار بعد</p>';
                }
            }
        } else {
            console.log('لا توجد إعدادات محفوظة');
        }
    } catch (error) {
        console.error('خطأ في تحميل إعدادات المدرسة:', error);
    }
}

/**
 * معالجة حفظ إعدادات المدرسة
 */
function handleSaveSchoolSettings() {
    // التحقق من الصلاحية
    if (!requirePermission('settings')) {
        return;
    }
    
    const schoolName = document.getElementById('school-name').value;
    const schoolPhone = document.getElementById('school-phone').value;
    const schoolDirector = document.getElementById('school-director').value;
    const schoolLogo = document.getElementById('school-logo').files[0];
    
    if (!schoolName.trim()) {
        showAlert('اسم المدرسة مطلوب', 'error');
        return;
    }
    
    const currentSettings = db.getSchoolSettings();
    const newSettings = {
        ...currentSettings,
        name: schoolName.trim(),
        phone: schoolPhone.trim(),
        director: schoolDirector.trim(),
        updated_at: new Date().toISOString()
    };
    
    // معالجة الشعار إذا تم رفعه
    if (schoolLogo) {
        console.log('معالجة شعار جديد:', schoolLogo.name, schoolLogo.size);
        const reader = new FileReader();
        reader.onload = function(e) {
            newSettings.logo = e.target.result;
            console.log('تم تحويل الشعار إلى base64، الحجم:', e.target.result.length);
            saveSettingsToDatabase(newSettings);
        };
        reader.readAsDataURL(schoolLogo);
    } else {
        // الاحتفاظ بالشعار السابق إذا لم يتم رفع شعار جديد
        const currentSettings = db.getSchoolSettings();
        if (currentSettings && currentSettings.logo) {
            newSettings.logo = currentSettings.logo;
            console.log('تم الاحتفاظ بالشعار السابق');
        }
        saveSettingsToDatabase(newSettings);
    }
}

/**
 * حفظ الإعدادات في قاعدة البيانات
 */
function saveSettingsToDatabase(settings) {
    const result = db.updateSchoolSettings(settings);
    
    if (result.success) {
        showAlert('تم حفظ الإعدادات بنجاح', 'success');
        
        // تحديث اسم المدرسة في شريط التنقل إذا كان موجوداً
        const navBrand = document.querySelector('.nav-brand span');
        if (navBrand) {
            navBrand.textContent = settings.name;
        }
        
        console.log('تم حفظ إعدادات المدرسة:', settings);
    } else {
        showAlert('حدث خطأ في حفظ الإعدادات: ' + result.error, 'error');
    }
}

/**
 * معاينة الشعار عند رفعه
 */
function previewLogo() {
    const logoInput = document.getElementById('school-logo');
    const logoPreview = document.getElementById('logo-preview');
    
    if (logoInput.files && logoInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            logoPreview.innerHTML = `<img src="${e.target.result}" alt="معاينة الشعار" style="max-width: 150px; max-height: 150px; border-radius: 5px; border: 1px solid #ddd;">`;
        };
        reader.readAsDataURL(logoInput.files[0]);
    }
}

/**
 * عرض نافذة معاينة السند مع طلب مبلغ الدفع
 */
function showReceiptPreview(studentId) {
    const student = db.getStudent(studentId);
    if (!student) {
        showAlert('الطالب غير موجود', 'error');
        return;
    }
    
    const fees = db.getStudentFees(studentId);
    const payments = db.getStudentPayments(studentId);
    const stats = calculateStudentStats(student, fees, payments);
    
    if (stats.remainingAmount <= 0) {
        showAlert('لا توجد رسوم مستحقة على هذا الطالب', 'info');
        return;
    }
    
    const amount = parseFloat(prompt('أدخل مبلغ الدفع:', stats.remainingAmount));
    if (isNaN(amount) || amount <= 0) {
        showAlert('مبلغ غير صحيح', 'error');
        return;
    }
    
    const paymentMethod = prompt('طريقة الدفع:', 'نقداً') || 'نقداً';
    
    previewReceipt(studentId, amount, paymentMethod);
}

/**
 * معاينة سند القبض قبل الطباعة
 */
function previewReceipt(studentId, paymentAmount, paymentMethod = 'نقداً') {
    const student = db.getStudent(studentId);
    if (!student) {
        showAlert('الطالب غير موجود', 'error');
        return;
    }

    const fees = db.getStudentFees(studentId);
    const payments = db.getStudentPayments(studentId);
    const stats = calculateStudentStats(student, fees, payments);
    const school = db.getSchoolSettings();
    const receiptNumber = generateReceiptNumber();
    
    const currentDate = new Date().toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const schoolLogo = school.logo || null;
    
    // إنشاء محتوى السند
    const receiptContent = generateReceiptHTML(student, stats, school, receiptNumber, paymentAmount, paymentMethod, currentDate, schoolLogo);
    
    // عرض المعاينة في نافذة منبثقة
    showPreviewModal('معاينة سند القبض', receiptContent, () => {
        generateReceipt(studentId, paymentAmount, paymentMethod);
    });
}

/**
 * معاينة إشعار المطالبة قبل الطباعة
 */
function previewDemandNotice(studentId) {
    const student = db.getStudent(studentId);
    const fees = db.getStudentFees(studentId);
    const payments = db.getStudentPayments(studentId);
    const stats = calculateStudentStats(student, fees, payments);
    const school = db.getSchoolSettings();
    
    if (stats.remainingAmount <= 0) {
        showAlert('لا توجد رسوم مستحقة على هذا الطالب', 'info');
        return;
    }
    
    // إنشاء محتوى الإشعار
    const noticeContent = generateDemandNoticeHTML(student, stats, school);
    
    // عرض المعاينة في نافذة منبثقة
    showPreviewModal('معاينة إشعار المطالبة', noticeContent, () => {
        generateDemandNotice(studentId);
    });
}

/**
 * عرض نافذة المعاينة
 */
function showPreviewModal(title, content, printCallback) {
    const modal = document.createElement('div');
    modal.className = 'preview-modal';
    modal.innerHTML = `
        <div class="preview-modal-content">
            <div class="preview-modal-header">
                <h3>${title}</h3>
                <button class="close-btn" onclick="closePreviewModal()">&times;</button>
            </div>
            <div class="preview-modal-body">
                <div class="preview-content">
                    ${content}
                </div>
            </div>
            <div class="preview-modal-footer">
                <button class="btn btn-primary" onclick="printPreview()">
                    <i class="fas fa-print"></i> طباعة
                </button>
                <button class="btn btn-secondary" onclick="closePreviewModal()">
                    <i class="fas fa-times"></i> إغلاق
                </button>
            </div>
        </div>
    `;
    
    // إضافة الأنماط
    if (!document.getElementById('preview-modal-styles')) {
        const styles = document.createElement('style');
        styles.id = 'preview-modal-styles';
        styles.textContent = `
            .preview-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            }
            
            .preview-modal-content {
                background: white;
                border-radius: 8px;
                max-width: 90%;
                max-height: 90%;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            
            .preview-modal-header {
                padding: 15px;
                border-bottom: 1px solid #ddd;
                display: flex;
                justify-content: space-between;
                align-items: center;
                background: #f8f9fa;
            }
            
            .preview-modal-header h3 {
                margin: 0;
                color: #333;
            }
            
            .close-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
            }
            
            .preview-modal-body {
                padding: 20px;
                overflow-y: auto;
                flex: 1;
            }
            
            .preview-content {
                border: 1px solid #ddd;
                border-radius: 4px;
                padding: 20px;
                background: white;
            }
            
            .preview-modal-footer {
                padding: 15px;
                border-top: 1px solid #ddd;
                text-align: right;
                background: #f8f9fa;
            }
            
            .preview-modal-footer .btn {
                margin-left: 10px;
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(modal);
    
    // حفظ callback للطباعة
    window.currentPrintCallback = printCallback;
}

/**
 * إغلاق نافذة المعاينة
 */
function closePreviewModal() {
    const modal = document.querySelector('.preview-modal');
    if (modal) {
        modal.remove();
    }
    window.currentPrintCallback = null;
}

/**
 * طباعة المعاينة
 */
function printPreview() {
    if (window.currentPrintCallback) {
        window.currentPrintCallback();
        closePreviewModal();
    }
}

/**
 * إنشاء HTML لسند القبض
 */
function generateReceiptHTML(student, stats, school, receiptNumber, paymentAmount, paymentMethod, currentDate, schoolLogo) {
    return `
        <div class="receipt-container">
            <div class="receipt-copy">
                <div class="header">
                    <div class="school-logo ${schoolLogo ? '' : 'default'}">
                        ${schoolLogo ? `<img src="${schoolLogo}" alt="شعار المدرسة">` : '🏫'}
                    </div>
                    <div class="school-name">${school.name}</div>
                    <div class="school-info">
                        <div>هاتف: ${school.phone || 'غير محدد'} | العنوان: ${school.address || 'عُمان'}</div>
                        <div>البريد الإلكتروني: ${school.email || 'info@school.om'}</div>
                    </div>
                    <div class="receipt-title">🧾 سند استلام رسوم مدرسية</div>
                </div>
                
                <div class="receipt-info">
                    <div class="info-row">
                        <span class="label">رقم السند:</span>
                        <span class="value">${receiptNumber}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">التاريخ:</span>
                        <span class="value print-date">${currentDate}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">اسم الطالب:</span>
                        <span class="value">${student.name}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">الصف:</span>
                        <span class="value">${student.grade}</span>
                    </div>
                    <div class="info-row">
                        <span class="label">ولي الأمر:</span>
                        <span class="value">${student.guardian_name}</span>
                    </div>
                </div>
                
                <div class="payment-details">
                    <div class="detail-row">
                        <span class="label">المبلغ المدفوع:</span>
                        <span class="amount">${formatCurrency(paymentAmount)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">طريقة الدفع:</span>
                        <span class="value">${paymentMethod}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">إجمالي الرسوم:</span>
                        <span class="amount">${formatCurrency(stats.totalFees)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">المدفوع سابقاً:</span>
                        <span class="amount">${formatCurrency(stats.totalPaid)}</span>
                    </div>
                    <div class="detail-row highlight">
                        <span class="label">المتبقي بعد هذا الدفع:</span>
                        <span class="amount">${formatCurrency(Math.max(0, stats.remainingAmount - paymentAmount))}</span>
                    </div>
                </div>
                
                <div class="notes">
                    <div class="note">💡 يرجى الاحتفاظ بهذا السند للمراجعة</div>
                    <div class="note">📞 للاستفسارات: ${school.phone || 'اتصل بالإدارة'}</div>
                </div>
                
                <div class="footer">
                    <div class="copy-label">نسخة الطالب</div>
                </div>
            </div>
        </div>
    `;
}

/**
 * إنشاء HTML لإشعار المطالبة
 */
function generateDemandNoticeHTML(student, stats, school) {
    const currentDate = new Date().toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const schoolLogo = school.logo || null;
    
    // حساب الأقساط المتأخرة
    let overdueInstallments = [];
    if (student.installments_count && student.first_installment_date && stats.totalFees > 0) {
        const installmentAmount = stats.totalFees / student.installments_count;
        const startDate = new Date(student.first_installment_date);
        const today = new Date();
        
        for (let i = 0; i < student.installments_count; i++) {
            const dueDate = new Date(startDate);
            dueDate.setMonth(startDate.getMonth() + i);
            
            if (dueDate < today) {
                const installmentsPaidAmount = (i + 1) * installmentAmount;
                if (stats.totalPaid < installmentsPaidAmount) {
                    overdueInstallments.push({
                        installment_number: i + 1,
                        amount: installmentAmount,
                        due_date: dueDate.toLocaleDateString('ar-EG'),
                        status: 'متأخر'
                    });
                }
            }
        }
    }
    
    return `
        <div class="notice">
            <div class="header">
                <div class="school-logo ${schoolLogo ? '' : 'default'}">
                    ${schoolLogo ? `<img src="${schoolLogo}" alt="شعار المدرسة">` : '⚠️'}
                </div>
                <div class="school-name">${school.name}</div>
                <div class="notice-title">📢 إشعار مطالبة بالرسوم المدرسية</div>
            </div>
            
            ${overdueInstallments.length > 0 ? `
            <div class="urgent-notice">
                🚨 تنبيه هام: يوجد أقساط متأخرة عن موعد الاستحقاق 🚨
            </div>` : ''}
            
            <div class="student-info">
                <div class="info-row">
                    <span class="label">اسم الطالب:</span>
                    <span class="value">${student.name}</span>
                </div>
                <div class="info-row">
                    <span class="label">الصف:</span>
                    <span class="value">${student.grade}</span>
                </div>
                <div class="info-row">
                    <span class="label">ولي الأمر:</span>
                    <span class="value">${student.guardian_name}</span>
                </div>
                <div class="info-row">
                    <span class="label">رقم الهاتف:</span>
                    <span class="value">${student.phone}</span>
                </div>
                <div class="info-row">
                    <span class="label">تاريخ الإشعار:</span>
                    <span class="value">${currentDate}</span>
                </div>
            </div>
            
            <div class="financial-summary">
                <div class="summary-title">📊 ملخص مالي</div>
                <div class="summary-row">
                    <span class="label">إجمالي الرسوم:</span>
                    <span class="amount">${formatCurrency(stats.totalFees)}</span>
                </div>
                <div class="summary-row">
                    <span class="label">المدفوع:</span>
                    <span class="amount paid">${formatCurrency(stats.totalPaid)}</span>
                </div>
                <div class="summary-row highlight">
                    <span class="label">المتبقي:</span>
                    <span class="amount outstanding">${formatCurrency(stats.remainingAmount)}</span>
                </div>
                ${stats.overdueAmount > 0 ? `
                <div class="summary-row urgent">
                    <span class="label">المتأخر:</span>
                    <span class="amount overdue">${formatCurrency(stats.overdueAmount)}</span>
                </div>` : ''}
            </div>
            
            ${overdueInstallments.length > 0 ? `
            <div class="overdue-installments">
                <div class="section-title">📅 الأقساط المتأخرة</div>
                ${overdueInstallments.map(installment => `
                    <div class="installment-row">
                        <span>القسط ${installment.installment_number}</span>
                        <span>${formatCurrency(installment.amount)}</span>
                        <span>مستحق: ${installment.due_date}</span>
                        <span class="overdue-status">${installment.status}</span>
                    </div>
                `).join('')}
            </div>` : ''}
            
            <div class="footer-notice">
                <div class="contact-info">
                    📞 للاستفسارات والمراجعة: ${school.phone || 'اتصل بالإدارة'}
                </div>
                <div class="important-note">
                    ⚠️ يرجى المبادرة بسداد المبلغ المطلوب في أقرب وقت ممكن
                </div>
            </div>
        </div>
    `;
}

/**
 * إنشاء تقرير الرسوم
 */
function generateFeesReport() {
    const students = db.getStudents();
    const fees = db.getFees();
    const school = db.getSchoolSettings();
    
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>تقرير الرسوم المدرسية</title>
            <style>
                body { font-family: 'Tajawal', Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .school-name { font-size: 24px; font-weight: bold; color: #4c51bf; }
                .report-title { font-size: 20px; margin: 10px 0; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                th { background-color: #f2f2f2; font-weight: bold; }
                .total-row { background-color: #e8f4f8; font-weight: bold; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="school-name">${school.name}</div>
                <div class="report-title">تقرير الرسوم المدرسية</div>
                <div>تاريخ التقرير: ${formatDate(new Date().toISOString())}</div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>رقم الطالب</th>
                        <th>اسم الطالب</th>
                        <th>الصف</th>
                        <th>إجمالي الرسوم</th>
                        <th>الخصم</th>
                        <th>صافي الرسوم</th>
                        <th>المسدد</th>
                        <th>المتبقي</th>
                        <th>الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    ${students.map(student => {
                        const studentFees = fees.find(fee => fee.student_id === student.id);
                        const payments = db.getStudentPayments(student.id);
                        const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
                        
                        return `
                            <tr>
                                <td>${student.student_number}</td>
                                <td>${student.name}</td>
                                <td>${student.grade}</td>
                                <td>${formatCurrency(studentFees ? studentFees.total_fees : 0)}</td>
                                <td>${formatCurrency(studentFees ? studentFees.discount_amount : 0)}</td>
                                <td>${formatCurrency(studentFees ? studentFees.net_fees : 0)}</td>
                                <td>${formatCurrency(totalPaid)}</td>
                                <td>${formatCurrency(studentFees ? studentFees.remaining_amount : 0)}</td>
                                <td>${studentFees ? studentFees.status : 'غير محدد'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            
            <script>
                window.print();
            </script>
        </body>
        </html>
    `);
    reportWindow.document.close();
}

/**
 * إنشاء تقرير الأقساط المتأخرة
 */
function generateOverdueReport() {
    const overdueStudents = db.getOverdueStudents();
    const school = db.getSchoolSettings();
    
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>تقرير الأقساط المتأخرة</title>
            <style>
                body { font-family: 'Tajawal', Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .school-name { font-size: 24px; font-weight: bold; color: #4c51bf; }
                .report-title { font-size: 20px; margin: 10px 0; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                th { background-color: #f2f2f2; font-weight: bold; }
                .overdue { background-color: #ffeaea; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="school-name">${school.name}</div>
                <div class="report-title">تقرير الأقساط المتأخرة</div>
                <div>تاريخ التقرير: ${formatDate(new Date().toISOString())}</div>
            </div>
            
            ${overdueStudents.length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th>اسم الطالب</th>
                            <th>الصف</th>
                            <th>رقم الهاتف</th>
                            <th>ولي الأمر</th>
                            <th>المبلغ المتأخر</th>
                            <th>عدد الأيام</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${overdueStudents.map(student => `
                            <tr class="overdue">
                                <td>${student.name}</td>
                                <td>${student.grade}</td>
                                <td>${student.phone}</td>
                                <td>${student.guardian_name}</td>
                                <td>${formatCurrency(student.overdueAmount)}</td>
                                <td>${student.overdueDays} يوم</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            ` : '<p style="text-align: center; font-size: 18px; color: #4c51bf;">لا توجد أقساط متأخرة</p>'}
            
            <script>
                window.print();
            </script>
        </body>
        </html>
    `);
    reportWindow.document.close();
}

/**
 * إنشاء تقرير الخصومات
 */
function generateDiscountsReport() {
    const students = db.getStudents();
    const studentsWithDiscounts = students.filter(student => student.discount_amount > 0);
    const school = db.getSchoolSettings();
    
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>تقرير الخصومات</title>
            <style>
                body { font-family: 'Tajawal', Arial, sans-serif; margin: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .school-name { font-size: 24px; font-weight: bold; color: #4c51bf; }
                .report-title { font-size: 20px; margin: 10px 0; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
                th { background-color: #f2f2f2; font-weight: bold; }
                @media print { body { margin: 0; } }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="school-name">${school.name}</div>
                <div class="report-title">تقرير الخصومات</div>
                <div>تاريخ التقرير: ${formatDate(new Date().toISOString())}</div>
            </div>
            
            ${studentsWithDiscounts.length > 0 ? `
                <table>
                    <thead>
                        <tr>
                            <th>اسم الطالب</th>
                            <th>الصف</th>
                            <th>ولي الأمر</th>
                            <th>مبلغ الخصم</th>
                            <th>سبب الخصم</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${studentsWithDiscounts.map(student => `
                            <tr>
                                <td>${student.name}</td>
                                <td>${student.grade}</td>
                                <td>${student.guardian_name}</td>
                                <td>${formatCurrency(student.discount_amount)}</td>
                                <td>${student.discount_reason || 'غير محدد'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div style="margin-top: 20px; font-size: 16px; font-weight: bold;">
                    إجمالي الخصومات: ${formatCurrency(studentsWithDiscounts.reduce((sum, student) => sum + student.discount_amount, 0))}
                </div>
            ` : '<p style="text-align: center; font-size: 18px; color: #4c51bf;">لا توجد خصومات ممنوحة</p>'}
            
            <script>
                window.print();
            </script>
        </body>
        </html>
    `);
    reportWindow.document.close();
}

/**
 * إغلاق وحذف النافذة المنبثقة
 */
function closeAndRemoveModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        setTimeout(() => {
            if (modal.parentNode) {
                modal.parentNode.removeChild(modal);
            }
        }, 300);
    }
}

/**
 * عرض رسالة تنبيه
 */
function showAlert(message, type = 'info') {
    const alertOverlay = document.getElementById('alert-overlay');
    const alertIcon = document.getElementById('alert-icon');
    const alertMessage = document.getElementById('alert-message');
    
    if (!alertOverlay || !alertIcon || !alertMessage) {
        console.warn('عناصر التنبيه غير موجودة');
        alert(message); // fallback
        return;
    }
    
    // تحديد أيقونة التنبيه
    alertIcon.className = 'fas ';
    switch(type) {
        case 'success':
            alertIcon.className += 'fa-check-circle';
            break;
        case 'error':
            alertIcon.className += 'fa-times-circle';
            break;
        case 'warning':
            alertIcon.className += 'fa-exclamation-triangle';
            break;
        default:
            alertIcon.className += 'fa-info-circle';
    }
    
    // تحديث الرسالة
    alertMessage.textContent = message;
    
    // عرض التنبيه
    alertOverlay.style.display = 'block';
}

/**
 * إغلاق نافذة التنبيه
 */
function closeAlert() {
    const alertOverlay = document.getElementById('alert-overlay');
    if (alertOverlay) {
        alertOverlay.style.display = 'none';
    }
}

/**
 * إغلاق وإزالة النوافذ المؤقتة
 */
function closeAndRemoveModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.remove();
    }
}

/**
 * تنسيق العملة
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('ar-OM', {
        style: 'currency',
        currency: 'OMR',
        minimumFractionDigits: 3
    }).format(amount || 0);
}

/**
 * تنسيق التاريخ
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// إضافة الأنماط الإضافية للتفاصيل
const additionalStyles = `
<style>
    .action-buttons {
        display: flex;
        gap: 0.5rem;
        justify-content: center;
    }
    
    .btn-sm {
        padding: 0.5rem;
        font-size: 0.875rem;
        min-width: auto;
    }
    
    .info-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        margin-bottom: 1.5rem;
    }
    
    .info-item {
        display: flex;
        justify-content: space-between;
        padding: 0.75rem;
        background: #f8f9fa;
        border-radius: 8px;
        border: 1px solid #e9ecef;
    }
    
    .info-item label {
        font-weight: 600;
        color: #495057;
    }
    
    .student-info h3,
    .fees-info h3,
    .payments-history h3 {
        color: #4c51bf;
        border-bottom: 2px solid #4c51bf;
        padding-bottom: 0.5rem;
        margin-bottom: 1rem;
    }
    
    .fees-summary {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
    }
    
    .fee-item {
        display: flex;
        justify-content: space-between;
        padding: 1rem;
        background: linear-gradient(135deg, #f8f9fa, #e9ecef);
        border-radius: 10px;
        border: 1px solid #dee2e6;
    }
    
    .payments-table {
        max-height: 300px;
        overflow-y: auto;
    }
    
    @media (max-width: 768px) {
        .info-grid {
            grid-template-columns: 1fr;
        }
        
        .action-buttons {
            flex-wrap: wrap;
        }
        
        .fees-summary {
            grid-template-columns: 1fr;
        }
    }
</style>
`;

/**
 * === وظائف إدارة الباص ===
 */

/**
 * تحميل بيانات الباص
 */
function loadBusData() {
    const busSubscriptions = db.getBusSubscriptions();
    const students = db.getStudents();
    
    // تحديث الإحصائيات
    updateBusStats(busSubscriptions);
    
    // عرض جدول الاشتراكات
    displayBusSubscriptions(busSubscriptions, students);
}

/**
 * تحديث إحصائيات الباص
 */
function updateBusStats(subscriptions) {
    const total = subscriptions.length;
    const active = subscriptions.filter(sub => sub.status === 'نشط').length;
    const expired = subscriptions.filter(sub => sub.status === 'منتهي').length;
    const totalRevenue = subscriptions.reduce((sum, sub) => sum + (sub.monthly_fee * sub.months_count), 0);
    
    document.getElementById('total-bus-subscribers').textContent = total;
    document.getElementById('active-bus-subscriptions').textContent = active;
    document.getElementById('expired-bus-subscriptions').textContent = expired;
    document.getElementById('total-bus-revenue').textContent = formatCurrency(totalRevenue);
}

/**
 * عرض جدول اشتراكات الباص
 */
function displayBusSubscriptions(subscriptions, students) {
    const tbody = document.getElementById('bus-subscriptions-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (subscriptions.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: #666;">
                    لا توجد اشتراكات باص مسجلة
                </td>
            </tr>
        `;
        return;
    }
    
    subscriptions.forEach(subscription => {
        const student = students.find(s => s.id === subscription.student_id);
        if (!student) return;
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${student.name}</td>
            <td>${student.grade}</td>
            <td>${student.phone}</td>
            <td>${formatDate(subscription.start_date)}</td>
            <td>${formatDate(subscription.end_date)}</td>
            <td>${formatCurrency(subscription.monthly_fee)}</td>
            <td>
                <span class="status-badge ${subscription.status === 'نشط' ? 'active' : 'expired'}">
                    ${subscription.status}
                </span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-primary btn-sm" onclick="generateBusReceipt(${subscription.id})" title="سند قبض">
                        <i class="fas fa-receipt"></i>
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="printBusReceipt(${subscription.id})" title="طباعة سند">
                        <i class="fas fa-print"></i>
                    </button>
                    <button class="btn btn-info btn-sm" onclick="manageBusStudentOperations(${subscription.student_id})" title="إدارة العمليات">
                        <i class="fas fa-cog"></i>
                    </button>
                    <button class="btn btn-success btn-sm" onclick="renewBusSubscription(${subscription.id})" title="تجديد">
                        <i class="fas fa-redo"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="cancelBusSubscription(${subscription.id})" title="إلغاء">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * عرض نافذة إضافة اشتراك باص
 */
function showBusSubscriptionModal() {
    const modal = document.getElementById('bus-subscription-modal');
    const studentSelect = document.getElementById('bus-student-select');
    
    if (modal && studentSelect) {
        // تحميل قائمة الطلاب
        const students = db.getStudents();
        studentSelect.innerHTML = '<option value="">اختر الطالب</option>';
        
        students.forEach(student => {
            const option = document.createElement('option');
            option.value = student.id;
            option.textContent = `${student.name} - ${student.grade}`;
            studentSelect.appendChild(option);
        });
        
        // تعيين تاريخ اليوم
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('bus-start-date').value = today;
        
        modal.style.display = 'block';
    }
}

/**
 * معالجة إضافة اشتراك باص جديد
 */
function handleAddBusSubscription() {
    const studentId = parseInt(document.getElementById('bus-student-select').value);
    const monthlyFee = parseFloat(document.getElementById('bus-monthly-fee').value);
    const startDate = document.getElementById('bus-start-date').value;
    const monthsCount = parseInt(document.getElementById('bus-months-count').value);
    const paymentMethod = document.getElementById('bus-payment-method').value;
    const notes = document.getElementById('bus-notes').value;
    
    if (!studentId || !monthlyFee || !startDate || !monthsCount) {
        showAlert('يرجى تعبئة جميع الحقول المطلوبة', 'error');
        return;
    }
    
    const subscriptionData = {
        student_id: studentId,
        monthly_fee: monthlyFee,
        start_date: startDate,
        months_count: monthsCount,
        payment_method: paymentMethod,
        notes: notes
    };
    
    const result = db.addBusSubscription(subscriptionData);
    
    if (result.success) {
        showAlert('تم إضافة اشتراك الباص بنجاح', 'success');
        closeModal('bus-subscription-modal');
        document.getElementById('bus-subscription-form').reset();
        loadBusData();
        loadDashboardData();
    } else {
        showAlert('حدث خطأ في إضافة الاشتراك: ' + result.error, 'error');
    }
}

/**
 * تجديد اشتراك باص
 */
function renewBusSubscription(subscriptionId) {
    const subscription = db.getBusSubscription(subscriptionId);
    if (!subscription) {
        showAlert('الاشتراك غير موجود', 'error');
        return;
    }
    
    const monthsToAdd = prompt('كم شهر تريد إضافة؟', '1');
    if (monthsToAdd && parseInt(monthsToAdd) > 0) {
        const result = db.renewBusSubscription(subscriptionId, parseInt(monthsToAdd));
        
        if (result.success) {
            showAlert('تم تجديد الاشتراك بنجاح', 'success');
            loadBusData();
        } else {
            showAlert('حدث خطأ في تجديد الاشتراك: ' + result.error, 'error');
        }
    }
}

/**
 * إلغاء اشتراك باص
 */
function cancelBusSubscription(subscriptionId) {
    if (confirm('هل أنت متأكد من إلغاء هذا الاشتراك؟')) {
        const result = db.cancelBusSubscription(subscriptionId);
        
        if (result.success) {
            showAlert('تم إلغاء الاشتراك بنجاح', 'success');
            loadBusData();
        } else {
            showAlert('حدث خطأ في إلغاء الاشتراك: ' + result.error, 'error');
        }
    }
}

/**
 * تجديد جميع الاشتراكات
 */
function renewAllSubscriptions() {
    if (confirm('هل تريد تجديد جميع الاشتراكات النشطة لشهر إضافي؟')) {
        const result = db.renewAllBusSubscriptions();
        
        if (result.success) {
            showAlert(`تم تجديد ${result.count} اشتراك بنجاح`, 'success');
            loadBusData();
        } else {
            showAlert('حدث خطأ في تجديد الاشتراكات: ' + result.error, 'error');
        }
    }
}

// إضافة الأنماط الإضافية إلى head
document.head.insertAdjacentHTML('beforeend', additionalStyles);

// إضافة أنماط خاصة بالباص
const busStyles = `
<style>
    .status-badge {
        padding: 0.25rem 0.75rem;
        border-radius: 50px;
        font-size: 0.875rem;
        font-weight: 500;
    }
    
    .status-badge.active {
        background-color: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
    }
    
    .status-badge.expired {
        background-color: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
    }
    
    .bus-content {
        padding: 2rem;
    }
    
    .bus-summary {
        margin-bottom: 2rem;
    }
    
    .bus-summary h3 {
        font-size: 1.5rem;
        font-weight: 600;
        color: #333;
        margin-bottom: 1.5rem;
    }
</style>
`;

document.head.insertAdjacentHTML('beforeend', busStyles);

/**
 * === وظائف تسجيل الدخول والصلاحيات ===
 */

/**
 * التحقق من حالة تسجيل الدخول
 */
function checkLoginStatus() {
    const loggedInUser = localStorage.getItem('logged_in_user');
    
    if (loggedInUser) {
        currentUser = JSON.parse(loggedInUser);
        hideLoginScreen();
        setUserPermissions(currentUser.role);
        updateUserInterface();
    } else {
        showLoginScreen();
    }
}

/**
 * عرض شاشة تسجيل الدخول
 */
function showLoginScreen() {
    document.body.classList.add('login-active');
    document.getElementById('login-screen').style.display = 'flex';
}

/**
 * إخفاء شاشة تسجيل الدخول
 */
function hideLoginScreen() {
    document.body.classList.remove('login-active');
    document.getElementById('login-screen').style.display = 'none';
}

/**
 * معالجة تسجيل الدخول
 */
function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const role = document.getElementById('user-role').value;
    
    if (!username || !password || !role) {
        showAlert('يرجى تعبئة جميع الحقول', 'error');
        return;
    }
    
    // التحقق من بيانات الدخول
    const validCredentials = validateCredentials(username, password, role);
    
    if (validCredentials) {
        currentUser = {
            username: username,
            role: role,
            name: getUserDisplayName(role),
            loginTime: new Date().toISOString()
        };
        
        localStorage.setItem('logged_in_user', JSON.stringify(currentUser));
        
        hideLoginScreen();
        setUserPermissions(role);
        updateUserInterface();
        
        showAlert(`أهلاً وسهلاً ${currentUser.name}`, 'success');
        
        // تسجيل عملية الدخول
        console.log(`تسجيل دخول: ${currentUser.name} - ${currentUser.role}`);
    } else {
        showAlert('بيانات الدخول غير صحيحة', 'error');
    }
}

/**
 * التحقق من صحة بيانات الدخول
 */
function validateCredentials(username, password, role) {
    const validAccounts = {
        'admin': { password: 'admin123', roles: ['admin'] },
        'accountant': { password: 'acc123', roles: ['accountant'] },
        'user': { password: 'user123', roles: ['user'] }
    };
    
    return validAccounts[username] && 
           validAccounts[username].password === password && 
           validAccounts[username].roles.includes(role);
}

/**
 * الحصول على اسم المستخدم للعرض
 */
function getUserDisplayName(role) {
    const names = {
        'admin': 'مدير النظام',
        'accountant': 'المحاسب',
        'user': 'الموظف'
    };
    return names[role] || 'مستخدم';
}

/**
 * تحديد صلاحيات المستخدم
 */
function setUserPermissions(role) {
    userPermissions = [];
    
    switch(role) {
        case 'admin':
            userPermissions = ['view', 'add', 'edit', 'delete', 'reports', 'settings', 'bus'];
            document.body.className = 'admin';
            break;
        case 'accountant':
            userPermissions = ['view', 'add', 'edit', 'reports', 'payments', 'settings'];
            document.body.className = 'accountant';
            break;
        case 'user':
            userPermissions = ['view', 'add'];
            document.body.className = 'user';
            break;
    }
}

/**
 * تحديث واجهة المستخدم حسب الصلاحيات
 */
function updateUserInterface() {
    // تحديث اسم المستخدم في الشريط العلوي
    const userNameElement = document.getElementById('current-user');
    if (userNameElement && currentUser) {
        userNameElement.textContent = currentUser.name;
    }
    
    // إخفاء/إظهار الأقسام حسب الصلاحيات
    if (!userPermissions.includes('settings')) {
        const settingsNavItem = document.querySelector('[onclick="showSection(\'settings\')"]');
        if (settingsNavItem) settingsNavItem.style.display = 'none';
    }
    
    if (!userPermissions.includes('bus')) {
        const busNavItem = document.querySelector('[onclick="showSection(\'bus\')"]');
        if (busNavItem) busNavItem.style.display = 'none';
    }
    
    // تقييد الأزرار حسب الصلاحيات
    if (!userPermissions.includes('delete')) {
        const deleteButtons = document.querySelectorAll('.btn-danger');
        deleteButtons.forEach(btn => {
            btn.style.display = 'none';
        });
    }
    
    if (!userPermissions.includes('edit')) {
        const editButtons = document.querySelectorAll('.btn-secondary');
        editButtons.forEach(btn => {
            if (btn.textContent.includes('تعديل')) {
                btn.style.display = 'none';
            }
        });
    }
}

/**
 * تسجيل الخروج
 */
function logout() {
    if (confirm('هل أنت متأكد من تسجيل الخروج؟')) {
        localStorage.removeItem('logged_in_user');
        currentUser = null;
        userPermissions = [];
        document.body.className = '';
        
        // إعادة تعيين النموذج
        document.getElementById('login-form').reset();
        
        showLoginScreen();
        showAlert('تم تسجيل الخروج بنجاح', 'success');
    }
}

/**
 * التحقق من الصلاحية
 */
function hasPermission(permission) {
    return userPermissions.includes(permission);
}

/**
 * منع الوصول بدون صلاحية
 */
function requirePermission(permission) {
    if (!hasPermission(permission)) {
        showAlert('ليس لديك صلاحية للقيام بهذا الإجراء', 'error');
        return false;
    }
    return true;
}

// إضافة مستمع الأحداث لنموذج تسجيل الدخول
document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

/**
 * إضافة زر تسجيل الخروج إلى شريط التنقل
 */
function addLogoutButton() {
    const navUser = document.querySelector('.nav-user');
    if (navUser && !document.getElementById('logout-btn')) {
        const logoutBtn = document.createElement('button');
        logoutBtn.id = 'logout-btn';
        logoutBtn.className = 'btn btn-secondary btn-sm';
        logoutBtn.style.marginLeft = '10px';
        logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> خروج';
        logoutBtn.onclick = logout;
        navUser.appendChild(logoutBtn);
    }
}

// إضافة زر الخروج عند تحميل الصفحة
setTimeout(addLogoutButton, 1000);

// =============== وظائف تعديل وإدارة الطلاب ===============

/**
 * فتح نافذة تعديل الطالب
 */
function editStudent(studentId) {
    const students = getStudents();
    const student = students.find(s => s.id === studentId);
    
    if (!student) {
        showAlert('لم يتم العثور على الطالب', 'error');
        return;
    }
    
    // ملء البيانات في النموذج
    document.getElementById('edit-student-id').value = student.id;
    document.getElementById('edit-student-name').value = student.name;
    document.getElementById('edit-student-grade').value = student.grade;
    document.getElementById('edit-student-phone').value = student.phone;
    document.getElementById('edit-guardian-type').value = student.guardian_type;
    
    // تحديث قائمة الموظفين
    loadEmployeesForEdit();
    
    // إظهار/إخفاء قائمة الموظفين
    handleEditGuardianTypeChange();
    
    if (student.guardian_type === 'employee' && student.employee_id) {
        document.getElementById('edit-employee-select').value = student.employee_id;
    }
    
    // فتح النافذة
    document.getElementById('edit-student-modal').style.display = 'block';
}

/**
 * تحميل قائمة الموظفين لنموذج التعديل
 */
function loadEmployeesForEdit() {
    const employees = getEmployees();
    const select = document.getElementById('edit-employee-select');
    
    // مسح الخيارات الموجودة
    select.innerHTML = '<option value="">اختر الموظف</option>';
    
    // إضافة الموظفين
    employees.forEach(employee => {
        const option = document.createElement('option');
        option.value = employee.id;
        option.textContent = employee.name;
        select.appendChild(option);
    });
}

/**
 * التعامل مع تغيير نوع ولي الأمر في نموذج التعديل
 */
function handleEditGuardianTypeChange() {
    const guardianType = document.getElementById('edit-guardian-type').value;
    const employeeGroup = document.getElementById('edit-employee-select-group');
    
    if (guardianType === 'employee') {
        employeeGroup.style.display = 'block';
    } else {
        employeeGroup.style.display = 'none';
        document.getElementById('edit-employee-select').value = '';
    }
}

/**
 * إغلاق نافذة تعديل الطالب
 */
function closeEditStudentModal() {
    document.getElementById('edit-student-modal').style.display = 'none';
    document.getElementById('edit-student-form').reset();
}

/**
 * حفظ تعديلات الطالب
 */
function handleEditStudent(event) {
    event.preventDefault();
    
    const studentId = document.getElementById('edit-student-id').value;
    const name = document.getElementById('edit-student-name').value.trim();
    const grade = document.getElementById('edit-student-grade').value;
    const phone = document.getElementById('edit-student-phone').value.trim();
    const guardianType = document.getElementById('edit-guardian-type').value;
    const employeeId = document.getElementById('edit-employee-select').value;
    
    // التحقق من صحة البيانات
    if (!name || !grade || !phone || !guardianType) {
        showAlert('يرجى ملء جميع الحقول المطلوبة', 'error');
        return;
    }
    
    if (guardianType === 'employee' && !employeeId) {
        showAlert('يرجى اختيار الموظف', 'error');
        return;
    }
    
    const students = getStudents();
    const studentIndex = students.findIndex(s => s.id === studentId);
    
    if (studentIndex === -1) {
        showAlert('لم يتم العثور على الطالب', 'error');
        return;
    }
    
    // تحديث بيانات الطالب
    const updatedStudent = {
        ...students[studentIndex],
        name: name,
        grade: grade,
        phone: phone,
        guardian_type: guardianType,
        employee_id: guardianType === 'employee' ? employeeId : null,
        guardian_name: guardianType === 'employee' ? 'ولي أمر موظف' : 'ولي أمر غير موظف',
        email: `${name.replace(/\s+/g, '').toLowerCase()}@example.com`,
        guardian_relationship: 'والد'
    };
    
    students[studentIndex] = updatedStudent;
    saveStudents(students);
    
    // تسجيل الإجراء
    logStudentAction(studentId, 'تعديل البيانات', `تم تعديل بيانات الطالب: ${name}`, getCurrentUser().username);
    
    // إغلاق النافذة وتحديث العرض
    closeEditStudentModal();
    showAlert('تم تحديث بيانات الطالب بنجاح', 'success');
    
    // تحديث العرض إذا كان في صفحة الطلاب
    if (typeof displayStudents === 'function') {
        loadStudentsPage();
    }
}

/**
 * فتح نافذة إدارة الطالب
 */
// متغير لحفظ ID الطالب المُدار حالياً
let currentStudentId = null;

function manageStudent(studentId) {
    try {
        const students = getStudents();
        const student = students.find(s => s.id === studentId);
        
        if (!student) {
            showAlert('لم يتم العثور على الطالب', 'error');
            return;
        }
        
        // حفظ ID الطالب الحالي
        currentStudentId = studentId;
        
        // التحقق من وجود النافذة
        const modal = document.getElementById('manage-student-modal');
        if (!modal) {
            showAlert('خطأ في النظام: لم يتم العثور على نافذة إدارة الطالب', 'error');
            return;
        }
        
        // تحديث معلومات الطالب في النافذة
        const nameElement = document.getElementById('manage-student-name');
        const gradeElement = document.getElementById('manage-student-grade');
        const feesElement = document.getElementById('manage-total-fees');
        
        if (nameElement) nameElement.textContent = student.name;
        if (gradeElement) gradeElement.textContent = student.grade;
        
        // حساب إجمالي الرسوم
        const fees = db.getStudentFees(studentId);
        const totalFees = fees ? fees.net_fees : (student.current_fees || 0);
        if (feesElement) feesElement.textContent = formatCurrency(totalFees);
        
        // تحميل بيانات الطالب
        loadStudentManagementData(studentId);
        
        // إظهار التبويب الأول
        showManageTab('payments');
        
        // فتح النافذة
        modal.style.display = 'block';
        
    } catch (error) {
        console.error('خطأ في فتح نافذة إدارة الطالب:', error);
        showAlert('حدث خطأ أثناء فتح نافذة إدارة الطالب', 'error');
    }
}

/**
 * الحصول على ID الطالب المُدار حالياً
 */
function getCurrentStudentId() {
    return currentStudentId;
}

/**
 * تحميل بيانات إدارة الطالب
 */
function loadStudentManagementData(studentId) {
    try {
        const student = db.getStudent(studentId);
        if (!student) return;
        
        const fees = db.getStudentFees(studentId);
        const payments = db.getStudentPayments(studentId);
        
        // تحميل الأقساط
        loadStudentInstallments(studentId);
        
        // تحميل المدفوعات
        loadStudentPayments(payments);
        
        // تحميل سجل الإجراءات
        loadStudentActionHistory(studentId);
        
        // تحديث الملخص
        updateStudentSummary(student, fees, payments);
    } catch (error) {
        console.error('خطأ في تحميل بيانات الطالب:', error);
    }
}

/**
 * تحميل أقساط الطالب
 */
function loadStudentInstallments(studentId) {
    const tbody = document.getElementById('installments-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const student = db.getStudent(studentId);
    const fees = db.getStudentFees(studentId);
    
    if (!student || !fees) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #666;">
                    لا توجد أقساط مسجلة لهذا الطالب
                </td>
            </tr>
        `;
        return;
    }
    
    // إنشاء أقساط افتراضية بناءً على بيانات الطالب
    const installmentAmount = fees.net_fees / student.installments_count;
    const startDate = new Date(student.first_installment_date);
    const payments = db.getStudentPayments(studentId);
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    
    for (let i = 0; i < student.installments_count; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(startDate.getMonth() + i);
        
        // حساب المبلغ المدفوع حتى هذا القسط
        const installmentsPaidAmount = (i + 1) * installmentAmount;
        const paid = totalPaid >= installmentsPaidAmount;
        const status = paid ? 'مدفوع' : 
                      dueDate < new Date() ? 'متأخر' : 'مستحق';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${i + 1}</td>
            <td>${formatDate(dueDate.toISOString().split('T')[0])}</td>
            <td>${formatCurrency(installmentAmount)}</td>
            <td><span class="status ${status === 'مدفوع' ? 'paid' : status === 'متأخر' ? 'overdue' : 'pending'}">${status}</span></td>
            <td>
                ${!paid ? 
                    `<button class="btn btn-sm btn-primary" onclick="payInstallment(${studentId}, ${i + 1})">
                        <i class="fas fa-money-bill"></i> دفع
                    </button>` : 
                    `<button class="btn btn-sm btn-secondary" onclick="printReceipt(${studentId})">
                        <i class="fas fa-print"></i> طباعة
                    </button>`
                }
            </td>
        `;
        tbody.appendChild(row);
    }
}

/**
 * تحميل مدفوعات الطالب
 */
function loadStudentPayments(payments) {
    const tbody = document.getElementById('payments-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (payments.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #666;">
                    لا توجد مدفوعات مسجلة لهذا الطالب
                </td>
            </tr>
        `;
        return;
    }
    
    payments.forEach(payment => {
        // التحقق من وجود معرف صحيح للمدفوعة
        if (!payment.id) {
            console.warn('مدفوعة بدون معرف:', payment);
            return; // تخطي المدفوعات بدون معرف
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(payment.payment_date)}</td>
            <td>${formatCurrency(payment.amount)}</td>
            <td>${payment.payment_method}</td>
            <td>${payment.receipt_number || 'غير محدد'}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="printReceipt(${payment.student_id})">
                    <i class="fas fa-print"></i> طباعة
                </button>
                <button class="btn btn-sm btn-danger" onclick="deletePayment(${payment.id})" title="حذف - معرف: ${payment.id}">
                    <i class="fas fa-trash"></i> حذف
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * تحميل سجل إجراءات الطالب
 */
function loadStudentActionHistory(studentId) {
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    const history = getStudentHistory(studentId);
    
    if (history.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 2rem; color: #666;">
                    لا توجد إجراءات مسجلة لهذا الطالب
                </td>
            </tr>
        `;
        return;
    }
    
    history.forEach(action => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(action.date)}</td>
            <td>${action.action_type}</td>
            <td>${action.details}</td>
            <td>${action.user}</td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * حساب إحصائيات الطالب المالية
 */
function calculateStudentStats(student, fees, payments) {
    const totalFees = fees ? fees.net_fees : (student.current_fees || 0);
    const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const remainingAmount = Math.max(0, totalFees - totalPaid);
    
    let overdueAmount = 0;
    let overdueCount = 0;
    
    // حساب المتأخرات بناءً على الأقساط
    if (student.installments_count && student.first_installment_date && totalFees > 0) {
        const installmentAmount = totalFees / student.installments_count;
        const startDate = new Date(student.first_installment_date);
        const today = new Date();
        
        for (let i = 0; i < student.installments_count; i++) {
            const dueDate = new Date(startDate);
            dueDate.setMonth(startDate.getMonth() + i);
            
            if (dueDate < today) {
                const installmentsPaidAmount = (i + 1) * installmentAmount;
                if (totalPaid < installmentsPaidAmount) {
                    const unpaidAmount = Math.min(installmentAmount, installmentsPaidAmount - totalPaid);
                    overdueAmount += unpaidAmount;
                    overdueCount++;
                }
            }
        }
    }
    
    const progressPercentage = totalFees > 0 ? Math.round((totalPaid / totalFees) * 100) : 0;
    
    return {
        totalFees,
        totalPaid,
        remainingAmount,
        overdueAmount,
        overdueCount,
        progressPercentage
    };
}

/**
 * تحديث ملخص الطالب ومؤشر التقدم
 */
function updateStudentSummary(student, fees, payments) {
    try {
        // حساب الإحصائيات باستخدام الدالة المساعدة
        const stats = calculateStudentStats(student, fees, payments);
        
        // تحديث المبالغ في واجهة المستخدم
        const summaryTotalElement = document.getElementById('summary-total-fees');
        const summaryPaidElement = document.getElementById('summary-paid-amount');
        const summaryRemainingElement = document.getElementById('summary-remaining-amount');
        const summaryOverdueElement = document.getElementById('summary-overdue-amount');
        
        if (summaryTotalElement) summaryTotalElement.textContent = formatCurrency(stats.totalFees);
        if (summaryPaidElement) summaryPaidElement.textContent = formatCurrency(stats.totalPaid);
        if (summaryRemainingElement) summaryRemainingElement.textContent = formatCurrency(stats.remainingAmount);
        if (summaryOverdueElement) summaryOverdueElement.textContent = formatCurrency(stats.overdueAmount);
        
        // تحديث مؤشر التقدم
        const progressBar = document.getElementById('payment-progress');
        const progressText = document.getElementById('payment-percentage');
        
        if (progressBar) {
            progressBar.style.width = stats.progressPercentage + '%';
            
            // تحديد اللون بناءً على النسبة والمتأخرات
            let color;
            if (stats.progressPercentage >= 100) {
                color = '#48bb78'; // أخضر - مكتمل
            } else if (stats.overdueAmount > 0) {
                color = '#e53e3e'; // أحمر - متأخرات
            } else if (stats.progressPercentage >= 75) {
                color = '#38a169'; // أخضر فاتح
            } else if (stats.progressPercentage >= 50) {
                color = '#ed8936'; // برتقالي
            } else {
                color = '#e53e3e'; // أحمر
            }
            
            progressBar.style.backgroundColor = color;
        }
        
        if (progressText) {
            let text = stats.progressPercentage + '%';
            if (stats.overdueAmount > 0) {
                text += ` (متأخرات: ${formatCurrency(stats.overdueAmount)})`;
            }
            progressText.textContent = text;
        }
        
    } catch (error) {
        console.error('خطأ في تحديث ملخص الطالب:', error);
    }
}

/**
 * تحديث معلومات الطالب في أعلى شاشة الإدارة
 */
function updateStudentHeaderInfo(studentId) {
    try {
        const student = db.getStudent(studentId);
        const fees = db.getStudentFees(studentId);
        const payments = db.getStudentPayments(studentId);
        
        if (!student) return;
        
        // حساب الإحصائيات باستخدام الدالة المساعدة
        const stats = calculateStudentStats(student, fees, payments);
        
        // تحديث المبلغ المتبقي في أعلى الشاشة
        const feesElement = document.getElementById('manage-total-fees');
        if (feesElement) {
            feesElement.textContent = formatCurrency(stats.remainingAmount);
            
            // تغيير لون النص بناءً على الحالة
            if (stats.progressPercentage >= 100) {
                feesElement.style.color = '#48bb78'; // أخضر - مكتمل
            } else if (stats.overdueAmount > 0) {
                feesElement.style.color = '#e53e3e'; // أحمر - متأخرات
            } else {
                feesElement.style.color = '#333'; // لون عادي
            }
        }
        
    } catch (error) {
        console.error('خطأ في تحديث معلومات رأس الشاشة:', error);
    }
}

/**
 * دفع قسط للطالب
 */
function payInstallment(studentId, installmentNumber) {
    // التحقق من المبالغ المتبقية أولاً
    const student = db.getStudent(studentId);
    const fees = db.getStudentFees(studentId);
    const payments = db.getStudentPayments(studentId);
    const stats = calculateStudentStats(student, fees, payments);
    
    if (stats.remainingAmount <= 0) {
        showAlert('تم سداد جميع المبالغ المستحقة على هذا الطالب', 'success');
        return;
    }
    
    // حساب القسط المقترح
    const suggestedAmount = student.installments_count ? 
        Math.min(stats.totalFees / student.installments_count, stats.remainingAmount) : 
        stats.remainingAmount;
    
    const amount = prompt(`أدخل مبلغ القسط:\n\nالمبلغ المتبقي: ${formatCurrency(stats.remainingAmount)}\nالقسط المقترح: ${formatCurrency(suggestedAmount)}\n\n(الحد الأقصى: ${formatCurrency(stats.remainingAmount)})`);
    
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        showAlert('يرجى إدخال مبلغ صحيح', 'error');
        return;
    }
    
    const paymentAmount = parseFloat(amount);
    
    // التحقق من عدم تجاوز المبلغ المتبقي
    if (paymentAmount > stats.remainingAmount) {
        showAlert(`لا يمكن دفع ${formatCurrency(paymentAmount)} لأن المبلغ المتبقي هو ${formatCurrency(stats.remainingAmount)} فقط`, 'error');
        return;
    }
    
    const paymentData = {
        student_id: studentId,
        amount: paymentAmount,
        payment_method: 'نقداً',
        payment_date: new Date().toISOString().split('T')[0],
        notes: `دفع القسط رقم ${installmentNumber}`
    };
    
    const result = db.addPayment(paymentData);
    
    if (result.success) {
        showAlert('تم دفع القسط بنجاح', 'success');
        
        // تحديث المعلومات في أعلى الشاشة
        updateStudentHeaderInfo(studentId);
        
        // إعادة تحميل بيانات الطالب
        loadStudentManagementData(studentId);
        
        // تحديث جدول الطلاب الرئيسي إذا كان مفتوحاً
        if (typeof loadStudentsData === 'function') {
            loadStudentsData();
        }
        
        // تسجيل الإجراء
        logStudentAction(studentId, 'دفع قسط', `تم دفع القسط رقم ${installmentNumber} بمبلغ ${formatCurrency(paymentAmount)}`);
    } else {
        showAlert('حدث خطأ في الدفع: ' + result.error, 'error');
    }
}

/**
 * حذف مدفوعة
 */
function deletePayment(paymentId) {
    if (confirm('هل أنت متأكد من حذف هذه المدفوعة؟\nسيتم إعادة احتساب المبالغ المتبقية.')) {
        const result = db.deletePayment(paymentId);
        
        if (result.success) {
            showAlert('تم حذف المدفوعة بنجاح', 'success');
            
            // تحديث جميع البيانات
            loadStudentsData(); // إعادة تحميل البيانات الرئيسية
            
            // إذا كانت نافذة إدارة الطالب مفتوحة، نحدثها
            const manageModal = document.getElementById('manage-student-modal');
            if (manageModal && manageModal.style.display === 'block' && result.deletedPayment) {
                const studentId = result.deletedPayment.student_id;
                updateStudentHeaderInfo(studentId);
                loadStudentManagementData(studentId);
                
                // تسجيل الإجراء
                logStudentAction(studentId, 'حذف مدفوعة', 
                    `تم حذف مدفوعة بمبلغ ${formatCurrency(result.deletedPayment.amount)} - إيصال رقم ${result.deletedPayment.receipt_number}`);
            }
            
        } else {
            showAlert('حدث خطأ في حذف المدفوعة: ' + result.error, 'error');
        }
    }
}

/**
 * إنشاء رقم سند
 */
function generateReceiptNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    return `${year}${month}${day}${time}`;
}

/**
 * تحميل سجل إجراءات الطالب
 */
function loadStudentHistory(studentId) {
    const history = getStudentHistory(studentId);
    const tbody = document.getElementById('history-tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (history.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" style="text-align: center; padding: 2rem; color: #666;">
                    لا توجد إجراءات مسجلة لهذا الطالب
                </td>
            </tr>
        `;
        return;
    }
    
    history.forEach(action => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${formatDate(action.date)}</td>
            <td>${action.action_type}</td>
            <td>${action.details}</td>
            <td>${action.user}</td>
        `;
        tbody.appendChild(row);
    });
}

/**
 * تحديث ملخص حساب الطالب
 */
function updateStudentSummary(studentId, payments, installments) {
    const students = getStudents();
    const student = students.find(s => s.id === studentId);
    
    if (!student) return;
    
    const totalFees = student.total_fees;
    const paidAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const remainingAmount = totalFees - paidAmount;
    
    // حساب المتأخرات
    const overdueInstallments = installments.filter(i => 
        i.status === 'متأخر' || (i.status === 'مستحق' && new Date(i.due_date) < new Date())
    );
    const overdueAmount = overdueInstallments.reduce((sum, i) => sum + i.amount, 0);
    
    // تحديث الكروت
    document.getElementById('summary-total-fees').textContent = formatCurrency(totalFees);
    document.getElementById('summary-paid-amount').textContent = formatCurrency(paidAmount);
    document.getElementById('summary-remaining-amount').textContent = formatCurrency(remainingAmount);
    document.getElementById('summary-overdue-amount').textContent = formatCurrency(overdueAmount);
    
    // تحديث شريط التقدم
    const paymentPercentage = totalFees > 0 ? Math.round((paidAmount / totalFees) * 100) : 0;
    document.getElementById('payment-progress').style.width = `${paymentPercentage}%`;
    document.getElementById('payment-percentage').textContent = `${paymentPercentage}%`;
}

/**
 * إظهار تبويب في نافذة إدارة الطالب
 */
function showManageTab(tabName, element) {
    // إخفاء جميع التبويبات
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // إزالة الحالة النشطة من الأزرار
    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // إظهار التبويب المطلوب
    document.getElementById(`${tabName}-tab`).classList.add('active');
    
    // تفعيل الزر المقابل
    if (element) {
        element.classList.add('active');
    } else {
        // إذا لم يتم تمرير العنصر، نبحث عن الزر الأول
        const firstBtn = document.querySelector('.tab-btn');
        if (firstBtn) firstBtn.classList.add('active');
    }
}

/**
 * تسجيل إجراء خاص بالطالب
 */
function logStudentAction(studentId, actionType, details, user = null) {
    const history = getStudentHistory();
    const currentUser = getCurrentUser();
    const newAction = {
        id: generateId(),
        student_id: studentId,
        date: new Date().toISOString(),
        action_type: actionType,
        details: details,
        user: user || (currentUser ? currentUser.name : 'مستخدم غير معروف')
    };
    
    history.push(newAction);
    localStorage.setItem('student_history', JSON.stringify(history));
}

/**
 * الحصول على المستخدم الحالي
 */
function getCurrentUser() {
    const loggedInUser = localStorage.getItem('logged_in_user');
    return loggedInUser ? JSON.parse(loggedInUser) : null;
}

/**
 * إنشاء معرف فريد
 */
function generateId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 5);
}

/**
 * الحصول على سجل إجراءات الطالب
 */
function getStudentHistory(studentId = null) {
    const history = JSON.parse(localStorage.getItem('student_history') || '[]');
    return studentId ? history.filter(h => h.student_id === studentId) : history;
}

/**
 * الحصول على جميع المدفوعات
 */
function getPayments() {
    return JSON.parse(localStorage.getItem('payments') || '[]');
}

/**
 * الحصول على جميع الأقساط
 */
function getInstallments() {
    return JSON.parse(localStorage.getItem('installments') || '[]');
}

/**
 * الحصول على جميع الطلاب
 */
function getStudents() {
    return db.getStudents();
}

/**
 * الحصول على جميع الموظفين
 */
function getEmployees() {
    return db.getEmployees();
}

// إضافة مستمعي الأحداث للنوافذ الجديدة
document.addEventListener('DOMContentLoaded', function() {
    // نموذج تعديل الطالب
    const editForm = document.getElementById('edit-student-form');
    if (editForm) {
        editForm.addEventListener('submit', handleEditStudent);
    }
    
    // إغلاق النوافذ
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.onclick = function() {
                modal.style.display = 'none';
            };
        }
        
        // إغلاق عند النقر خارج النافذة
        window.onclick = function(event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        };
    });
});

/**
 * إنشاء سند قبض لاشتراك الباص
 */
function generateBusReceipt(subscriptionId) {
    const subscription = db.getBusSubscription(subscriptionId);
    const student = db.getStudent(subscription.student_id);
    const school = db.getSchoolSettings();
    
    if (!subscription || !student) {
        showAlert('بيانات الاشتراك غير متوفرة', 'error');
        return;
    }
    
    // إنشاء رقم سند فريد
    const receiptNumber = 'BUS-' + Date.now();
    
    // حساب المبلغ الإجمالي
    const totalAmount = subscription.monthly_fee * subscription.months_count;
    
    const busPayment = {
        id: Date.now(),
        subscription_id: subscriptionId,
        student_id: subscription.student_id,
        receipt_number: receiptNumber,
        amount: totalAmount,
        payment_method: subscription.payment_method || 'نقداً',
        payment_date: new Date().toISOString().split('T')[0],
        payment_type: 'اشتراك باص',
        notes: `اشتراك باص لمدة ${subscription.months_count} شهر/أشهر`
    };
    
    // حفظ السند في قاعدة البيانات
    const result = db.addBusPayment(busPayment);
    
    if (result.success) {
        showAlert('تم إنشاء سند القبض بنجاح', 'success');
        generateBusReceiptDocument(result.payment, student, subscription, school);
        loadBusData(); // تحديث البيانات
    } else {
        showAlert('حدث خطأ في إنشاء سند القبض: ' + result.error, 'error');
    }
}

/**
 * إنشاء مستند سند قبض الباص
 */
function generateBusReceiptDocument(payment, student, subscription, school) {
    const currentDate = new Date().toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const schoolLogo = school.logo || null;
    
    const receiptWindow = window.open('', '_blank');
    receiptWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>سند استلام اشتراك باص - ${payment.receipt_number}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                * { box-sizing: border-box; }
                
                body { 
                    font-family: 'Tajawal', Arial, sans-serif; 
                    margin: 0; 
                    padding: 0;
                    background: white;
                    color: #333;
                    line-height: 1.2;
                    font-size: 10px;
                }
                
                .receipt-container {
                    display: flex;
                    flex-direction: column;
                    width: 100%;
                    max-width: 210mm;
                    margin: 0 auto;
                    margin-left: 10mm;
                    page-break-inside: avoid;
                }
                
                .receipt { 
                    background: white;
                    border: 1px solid #2d3748;
                    border-radius: 4px;
                    padding: 8mm;
                    width: 190mm;
                    height: 125mm;
                    margin: 3mm auto;
                    font-size: 9px;
                    page-break-inside: avoid;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                    box-sizing: border-box;
                }
                
                .receipt:first-child { margin-top: 0; }
                .receipt:last-child { margin-bottom: 0; }
                
                .header { 
                    text-align: center;
                    margin-bottom: 8px;
                    border-bottom: 1px solid #4c51bf;
                    padding-bottom: 4px;
                    position: relative;
                }
                
                .school-logo {
                    width: 30px;
                    height: 30px;
                    margin: 0 auto 3px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                }
                
                .school-logo img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                
                .school-logo.default {
                    background: #4c51bf;
                    color: white;
                    font-size: 10px;
                    font-weight: bold;
                }
                
                .school-name { 
                    font-size: 11px;
                    font-weight: bold;
                    color: #2d3748;
                    margin: 2px 0;
                }
                
                .school-info {
                    font-size: 7px;
                    color: #666;
                    margin: 1px 0;
                }
                
                .receipt-title { 
                    font-size: 10px;
                    font-weight: bold;
                    color: #4c51bf;
                    margin: 4px 0;
                }
                
                .receipt-details {
                    display: flex;
                    justify-content: space-between;
                    margin: 4px 0;
                    font-size: 6px;
                }
                
                .receipt-number { 
                    font-size: 8px;
                    font-weight: bold;
                    color: #e53e3e;
                    background: #fed7d7;
                    padding: 1px 4px;
                    border-radius: 6px;
                    display: inline-block;
                }
                
                .content { 
                    margin: 6px 0;
                    background: #f7fafc;
                    padding: 6px;
                    border-radius: 3px;
                    border: 1px solid #e2e8f0;
                    flex: 1;
                }
                
                .row { 
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin: 4px 0;
                    padding: 3px 0;
                    border-bottom: 1px solid #e2e8f0;
                }
                
                .row:last-child { border-bottom: none; }
                
                .label { 
                    font-weight: bold;
                    color: #4a5568;
                    font-size: 9px;
                    min-width: 60px;
                }
                
                .value {
                    font-size: 9px;
                    color: #2d3748;
                    font-weight: 500;
                }
                
                .amount {
                    font-size: 11px;
                    font-weight: bold;
                    color: #38a169;
                    background: #c6f6d5;
                    padding: 2px 6px;
                    border-radius: 10px;
                    border: 1px solid #38a169;
                }
                
                .amount-words {
                    text-align: center;
                    margin: 6px 0;
                    font-size: 8px;
                    font-weight: bold;
                    color: #4a5568;
                    background: #edf2f7;
                    padding: 4px;
                    border-radius: 3px;
                    border-right: 2px solid #4c51bf;
                }
                
                .footer { 
                    text-align: center;
                    margin-top: 8px;
                    border-top: 1px solid #4c51bf;
                    padding-top: 6px;
                }
                
                .thank-you {
                    font-size: 8px;
                    color: #4c51bf;
                    font-weight: bold;
                    margin-bottom: 8px;
                }
                
                .signatures { 
                    display: flex;
                    justify-content: space-between;
                    margin-top: 10px;
                    padding: 0 6px;
                }
                
                .signature { 
                    text-align: center;
                    min-width: 60px;
                }
                
                .signature-title {
                    font-weight: bold;
                    color: #4a5568;
                    margin-bottom: 12px;
                    font-size: 7px;
                }
                
                .signature-line {
                    border-bottom: 1px solid #2d3748;
                    height: 1px;
                    margin-top: 3px;
                }
                
                .print-date {
                    position: absolute;
                    top: 3px;
                    left: 6px;
                    font-size: 6px;
                    color: #666;
                }
                
                .copy-label {
                    position: absolute;
                    top: 3px;
                    right: 6px;
                    font-size: 6px;
                    color: #666;
                    font-weight: bold;
                }
                
                @media print { 
                    * {
                        -webkit-print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    
                    body { 
                        margin: 0 !important; 
                        padding: 0 !important;
                        background: white !important;
                        font-size: 8px !important;
                    }
                    
                    .receipt-container {
                        width: 210mm !important;
                        margin: 0 auto !important;
                        padding: 0 !important;
                    }
                    
                    .receipt {
                        box-shadow: none !important;
                        border: 1px solid #000 !important;
                        margin: 2mm auto !important;
                        width: 190mm !important;
                        height: 125mm !important;
                        page-break-inside: avoid !important;
                        page-break-after: avoid !important;
                    }
                    
                    .receipt:first-child { margin-top: 0 !important; }
                    .receipt:last-child { margin-bottom: 0 !important; }
                    .print-date, .copy-label { color: #000 !important; }
                }
            </style>
        </head>
        <body>
            <div class="receipt-container">
                <!-- النسخة الأولى - نسخة الطالب -->
                <div class="receipt">
                    <div class="print-date">تاريخ الطباعة: ${currentDate}</div>
                    <div class="copy-label">نسخة الطالب</div>
                    
                    <div class="header">
                        <div class="school-logo ${schoolLogo ? '' : 'default'}">
                            ${schoolLogo ? `<img src="${schoolLogo}" alt="شعار المدرسة">` : '🚌'}
                        </div>
                        <div class="school-name">${school.name}</div>
                        <div class="school-info">
                            <div>هاتف: ${school.phone || 'غير محدد'} | العنوان: ${school.address || 'عُمان'}</div>
                            <div>البريد الإلكتروني: ${school.email || 'info@school.om'}</div>
                        </div>
                        <div class="receipt-title">🚌 سند استلام اشتراك باص مدرسي</div>
                        
                        <div class="receipt-details">
                            <div class="receipt-number">رقم السند: ${payment.receipt_number}</div>
                            <div style="font-size: 6px; color: #666;">
                                السنة الدراسية: ${new Date().getFullYear()}/${new Date().getFullYear() + 1}
                            </div>
                        </div>
                    </div>
                    
                    <div class="content">
                        <div class="row">
                            <span class="label">👤 اسم الطالب:</span>
                            <span class="value">${student.name}</span>
                        </div>
                        <div class="row">
                            <span class="label">🎓 الصف الدراسي:</span>
                            <span class="value">${student.grade}</span>
                        </div>
                        <div class="row">
                            <span class="label">👨‍👩‍👧‍👦 ولي الأمر:</span>
                            <span class="value">${student.guardian_type === 'موظف' && student.employee_name ? student.employee_name : student.guardian_type}</span>
                        </div>
                        <div class="row">
                            <span class="label">📅 مدة الاشتراك:</span>
                            <span class="value">${subscription.months_count} شهر/أشهر</span>
                        </div>
                        <div class="row">
                            <span class="label">📅 من تاريخ:</span>
                            <span class="value">${formatDate(subscription.start_date)}</span>
                        </div>
                        <div class="row">
                            <span class="label">📅 إلى تاريخ:</span>
                            <span class="value">${formatDate(subscription.end_date)}</span>
                        </div>
                        <div class="row">
                            <span class="label">💰 المبلغ المسدد:</span>
                            <span class="amount">${formatCurrency(payment.amount)}</span>
                        </div>
                        <div class="row">
                            <span class="label">💳 طريقة الدفع:</span>
                            <span class="value">${payment.payment_method}</span>
                        </div>
                        
                        <div class="amount-words">
                            المبلغ بالكلمات: ${convertNumberToArabicWords(payment.amount)} ريال عماني
                        </div>
                    </div>
                    
                    <div class="footer">
                        <div class="thank-you">
                            🚌 شكراً لكم على اشتراككم في خدمة الباص المدرسي 🚌
                        </div>
                        
                        <div class="signatures">
                            <div class="signature">
                                <div class="signature-title">توقيع المحاسب</div>
                                <div class="signature-line"></div>
                            </div>
                            <div class="signature">
                                <div class="signature-title">توقيع ولي الأمر</div>
                                <div class="signature-line"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- النسخة الثانية - نسخة الحسابات -->
                <div class="receipt">
                    <div class="print-date">تاريخ الطباعة: ${currentDate}</div>
                    <div class="copy-label">نسخة الحسابات</div>
                    
                    <div class="header">
                        <div class="school-logo ${schoolLogo ? '' : 'default'}">
                            ${schoolLogo ? `<img src="${schoolLogo}" alt="شعار المدرسة">` : '🚌'}
                        </div>
                        <div class="school-name">${school.name}</div>
                        <div class="school-info">
                            <div>هاتف: ${school.phone || 'غير محدد'} | العنوان: ${school.address || 'عُمان'}</div>
                            <div>البريد الإلكتروني: ${school.email || 'info@school.om'}</div>
                        </div>
                        <div class="receipt-title">🚌 سند استلام اشتراك باص مدرسي</div>
                        
                        <div class="receipt-details">
                            <div class="receipt-number">رقم السند: ${payment.receipt_number}</div>
                            <div style="font-size: 6px; color: #666;">
                                السنة الدراسية: ${new Date().getFullYear()}/${new Date().getFullYear() + 1}
                            </div>
                        </div>
                    </div>
                    
                    <div class="content">
                        <div class="row">
                            <span class="label">👤 اسم الطالب:</span>
                            <span class="value">${student.name}</span>
                        </div>
                        <div class="row">
                            <span class="label">🎓 الصف الدراسي:</span>
                            <span class="value">${student.grade}</span>
                        </div>
                        <div class="row">
                            <span class="label">👨‍👩‍👧‍👦 ولي الأمر:</span>
                            <span class="value">${student.guardian_type === 'موظف' && student.employee_name ? student.employee_name : student.guardian_type}</span>
                        </div>
                        <div class="row">
                            <span class="label">📅 مدة الاشتراك:</span>
                            <span class="value">${subscription.months_count} شهر/أشهر</span>
                        </div>
                        <div class="row">
                            <span class="label">📅 من تاريخ:</span>
                            <span class="value">${formatDate(subscription.start_date)}</span>
                        </div>
                        <div class="row">
                            <span class="label">📅 إلى تاريخ:</span>
                            <span class="value">${formatDate(subscription.end_date)}</span>
                        </div>
                        <div class="row">
                            <span class="label">💰 المبلغ المسدد:</span>
                            <span class="amount">${formatCurrency(payment.amount)}</span>
                        </div>
                        <div class="row">
                            <span class="label">💳 طريقة الدفع:</span>
                            <span class="value">${payment.payment_method}</span>
                        </div>
                        
                        <div class="amount-words">
                            المبلغ بالكلمات: ${convertNumberToArabicWords(payment.amount)} ريال عماني
                        </div>
                    </div>
                    
                    <div class="footer">
                        <div class="thank-you">
                            🚌 شكراً لكم على اشتراككم في خدمة الباص المدرسي 🚌
                        </div>
                        
                        <div class="signatures">
                            <div class="signature">
                                <div class="signature-title">توقيع المحاسب</div>
                                <div class="signature-line"></div>
                            </div>
                            <div class="signature">
                                <div class="signature-title">توقيع ولي الأمر</div>
                                <div class="signature-line"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <script>
                setTimeout(() => {
                    window.print();
                    setTimeout(() => window.close(), 1000);
                }, 500);
            </script>
        </body>
        </html>
    `);
    receiptWindow.document.close();
}

/**
 * طباعة سند اشتراك الباص
 */
function printBusReceipt(subscriptionId) {
    const subscription = db.getBusSubscription(subscriptionId);
    if (!subscription) {
        showAlert('بيانات الاشتراك غير متوفرة', 'error');
        return;
    }
    
    // البحث عن سند قبض موجود للاشتراك
    const busPayments = db.getBusPayments();
    const existingPayment = busPayments.find(payment => payment.subscription_id === subscriptionId);
    
    if (existingPayment) {
        // طباعة السند الموجود
        const student = db.getStudent(subscription.student_id);
        const school = db.getSchoolSettings();
        generateBusReceiptDocument(existingPayment, student, subscription, school);
    } else {
        // إنشاء سند مؤقت للطباعة
        const tempPayment = {
            receipt_number: 'BUS-' + subscriptionId,
            amount: subscription.monthly_fee * subscription.months_count,
            payment_method: subscription.payment_method || 'نقداً',
            payment_date: new Date().toISOString().split('T')[0],
            payment_type: 'اشتراك باص',
            notes: `اشتراك باص لمدة ${subscription.months_count} شهر/أشهر`
        };
        
        const student = db.getStudent(subscription.student_id);
        const school = db.getSchoolSettings();
        generateBusReceiptDocument(tempPayment, student, subscription, school);
    }
}

/**
 * إدارة عمليات الطالب في الباص
 */
function manageBusStudentOperations(studentId) {
    const student = db.getStudent(studentId);
    const busSubscriptions = db.getBusSubscriptions().filter(sub => sub.student_id === studentId);
    
    if (!student) {
        showAlert('بيانات الطالب غير متوفرة', 'error');
        return;
    }
    
    // إنشاء نافذة إدارة العمليات
    const modal = createBusOperationsModal(student, busSubscriptions);
    document.body.appendChild(modal);
    modal.style.display = 'block';
}

/**
 * إنشاء نافذة إدارة عمليات الباص
 */
function createBusOperationsModal(student, subscriptions) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'bus-operations-modal';
    
    const totalAmount = subscriptions.reduce((sum, sub) => sum + (sub.monthly_fee * sub.months_count), 0);
    const totalSubscriptions = subscriptions.length;
    const activeSubscriptions = subscriptions.filter(sub => sub.status === 'نشط').length;
    
    modal.innerHTML = `
        <div class="modal-content large-modal">
            <span class="close" onclick="closeAndRemoveModal('bus-operations-modal')">&times;</span>
            <div class="modal-header">
                <h2>إدارة اشتراكات الباص - ${student.name}</h2>
                <div class="student-info-summary">
                    <div class="info-card">
                        <i class="fas fa-user"></i>
                        <span>${student.name}</span>
                    </div>
                    <div class="info-card">
                        <i class="fas fa-graduation-cap"></i>
                        <span>${student.grade}</span>
                    </div>
                    <div class="info-card">
                        <i class="fas fa-bus"></i>
                        <span>${totalSubscriptions} اشتراك</span>
                    </div>
                    <div class="info-card">
                        <i class="fas fa-money-bill"></i>
                        <span>${formatCurrency(totalAmount)}</span>
                    </div>
                </div>
            </div>
            
            <div class="manage-tabs">
                <button class="tab-btn active" onclick="showBusOperationsTab('subscriptions', this)">الاشتراكات</button>
                <button class="tab-btn" onclick="showBusOperationsTab('summary', this)">الملخص</button>
            </div>
            
            <!-- تبويب الاشتراكات -->
            <div id="bus-subscriptions-tab" class="tab-content active">
                <div class="operations-section">
                    <h3>اشتراكات الباص</h3>
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>تاريخ البداية</th>
                                    <th>تاريخ النهاية</th>
                                    <th>المدة</th>
                                    <th>المبلغ الشهري</th>
                                    <th>الإجمالي</th>
                                    <th>الحالة</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${subscriptions.length > 0 ? subscriptions.map(subscription => `
                                    <tr>
                                        <td>${formatDate(subscription.start_date)}</td>
                                        <td>${formatDate(subscription.end_date)}</td>
                                        <td>${subscription.months_count} شهر/أشهر</td>
                                        <td>${formatCurrency(subscription.monthly_fee)}</td>
                                        <td>${formatCurrency(subscription.monthly_fee * subscription.months_count)}</td>
                                        <td>
                                            <span class="status-badge ${subscription.status === 'نشط' ? 'active' : 'expired'}">
                                                ${subscription.status}
                                            </span>
                                        </td>
                                        <td>
                                            <button class="btn btn-primary btn-sm" onclick="generateBusReceipt(${subscription.id})" title="سند قبض">
                                                <i class="fas fa-receipt"></i>
                                            </button>
                                            <button class="btn btn-secondary btn-sm" onclick="printBusReceipt(${subscription.id})" title="طباعة">
                                                <i class="fas fa-print"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('') : '<tr><td colspan="7" style="text-align: center; color: #666;">لا توجد اشتراكات مسجلة</td></tr>'}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            
            <!-- تبويب الملخص -->
            <div id="bus-summary-tab" class="tab-content">
                <div class="summary-cards">
                    <div class="summary-card">
                        <div class="card-icon">
                            <i class="fas fa-bus"></i>
                        </div>
                        <div class="card-content">
                            <h4>إجمالي الاشتراكات</h4>
                            <span class="amount">${totalSubscriptions}</span>
                        </div>
                    </div>
                    
                    <div class="summary-card">
                        <div class="card-icon">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <div class="card-content">
                            <h4>الاشتراكات النشطة</h4>
                            <span class="amount">${activeSubscriptions}</span>
                        </div>
                    </div>
                    
                    <div class="summary-card">
                        <div class="card-icon">
                            <i class="fas fa-money-bill-wave"></i>
                        </div>
                        <div class="card-content">
                            <h4>إجمالي المبالغ</h4>
                            <span class="amount">${formatCurrency(totalAmount)}</span>
                        </div>
                    </div>
                    
                    <div class="summary-card">
                        <div class="card-icon">
                            <i class="fas fa-calendar"></i>
                        </div>
                        <div class="card-content">
                            <h4>متوسط المدة</h4>
                            <span class="amount">${subscriptions.length > 0 ? Math.round(subscriptions.reduce((sum, sub) => sum + sub.months_count, 0) / subscriptions.length) : 0} شهر</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    return modal;
}

/**
 * عرض تبويب معين في نافذة عمليات الباص
 */
function showBusOperationsTab(tabName, button) {
    // إخفاء جميع التبويبات
    const tabs = document.querySelectorAll('#bus-operations-modal .tab-content');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // إزالة الحالة النشطة من جميع الأزرار
    const buttons = document.querySelectorAll('#bus-operations-modal .tab-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    
    // إظهار التبويب المطلوب
    const targetTab = document.getElementById(`bus-${tabName}-tab`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // تفعيل الزر المطلوب
    if (button) {
        button.classList.add('active');
    }
}

// متغير عام لحفظ البيانات المفلترة
let filteredReportsData = null;

/**
 * تطبيق عوامل التصفية على التقارير
 */
function applyReportsFilters() {
    const students = db.getStudents();
    
    // الحصول على قيم التصفية
    const gradeFilter = document.getElementById('report-grade-filter').value;
    const guardianFilter = document.getElementById('report-guardian-filter').value;
    const paymentStatusFilter = document.getElementById('report-payment-status-filter').value;
    const dateFrom = document.getElementById('report-date-from').value;
    const dateTo = document.getElementById('report-date-to').value;
    const amountFrom = parseFloat(document.getElementById('report-amount-from').value) || 0;
    const amountTo = parseFloat(document.getElementById('report-amount-to').value) || Infinity;
    
    // تطبيق التصفية
    filteredReportsData = students.filter(student => {
        // تصفية حسب الصف
        if (gradeFilter && student.grade !== gradeFilter) {
            return false;
        }
        
        // تصفية حسب نوع ولي الأمر
        if (guardianFilter && student.guardian_type !== guardianFilter) {
            return false;
        }
        
        // حساب إحصائيات الطالب للتصفية
        const fees = db.getStudentFees(student.id);
        const payments = db.getStudentPayments(student.id);
        const stats = calculateStudentStats(student, fees, payments);
        
        // تصفية حسب حالة السداد
        if (paymentStatusFilter) {
            const paymentStatus = getPaymentStatus(stats);
            if (paymentStatus !== paymentStatusFilter) {
                return false;
            }
        }
        
        // تصفية حسب المبلغ
        if (stats.totalFees < amountFrom || stats.totalFees > amountTo) {
            return false;
        }
        
        // تصفية حسب التاريخ (يمكن تطبيقها على تاريخ التسجيل أو آخر دفعة)
        if (dateFrom || dateTo) {
            const studentDate = new Date(student.created_at || new Date());
            const fromDate = dateFrom ? new Date(dateFrom) : new Date('1900-01-01');
            const toDate = dateTo ? new Date(dateTo) : new Date();
            
            if (studentDate < fromDate || studentDate > toDate) {
                return false;
            }
        }
        
        return true;
    });
    
    showAlert(`تم تطبيق التصفية. عدد النتائج: ${filteredReportsData.length} طالب`, 'success');
    
    // عرض الإحصائيات تلقائياً
    showFilteredStats();
}

/**
 * مسح عوامل التصفية
 */
function clearReportsFilters() {
    document.getElementById('report-grade-filter').value = '';
    document.getElementById('report-guardian-filter').value = '';
    document.getElementById('report-payment-status-filter').value = '';
    document.getElementById('report-date-from').value = '';
    document.getElementById('report-date-to').value = '';
    document.getElementById('report-amount-from').value = '';
    document.getElementById('report-amount-to').value = '';
    
    filteredReportsData = null;
    
    // إخفاء الإحصائيات
    document.getElementById('filtered-stats').style.display = 'none';
    
    showAlert('تم مسح جميع عوامل التصفية', 'info');
}

/**
 * عرض إحصائيات البيانات المفلترة
 */
function showFilteredStats() {
    const dataToAnalyze = filteredReportsData || db.getStudents();
    
    if (dataToAnalyze.length === 0) {
        showAlert('لا توجد طلاب مسجلين في النظام. يرجى إضافة طلاب أولاً من قسم إدارة الطلاب.', 'info');
        return;
    }
    
    let totalFees = 0;
    let totalPaid = 0;
    let totalPending = 0;
    
    dataToAnalyze.forEach(student => {
        const fees = db.getStudentFees(student.id);
        const payments = db.getStudentPayments(student.id);
        const stats = calculateStudentStats(student, fees, payments);
        
        totalFees += stats.totalFees;
        totalPaid += stats.totalPaid;
        totalPending += stats.remainingAmount;
    });
    
    // تحديث الإحصائيات في الواجهة
    document.getElementById('filtered-students-count').textContent = dataToAnalyze.length;
    document.getElementById('filtered-total-fees').textContent = formatCurrency(totalFees);
    document.getElementById('filtered-paid-fees').textContent = formatCurrency(totalPaid);
    document.getElementById('filtered-pending-fees').textContent = formatCurrency(totalPending);
    
    // إظهار قسم الإحصائيات
    document.getElementById('filtered-stats').style.display = 'block';
    
    // تمرير سلس إلى الإحصائيات
    document.getElementById('filtered-stats').scrollIntoView({ behavior: 'smooth' });
}

/**
 * تحديد حالة السداد للطالب
 */
function getPaymentStatus(stats) {
    if (stats.remainingAmount <= 0) {
        return 'مسدد';
    } else if (stats.totalPaid > 0) {
        if (stats.overdueAmount > 0) {
            return 'متأخر';
        }
        return 'جزئي';
    } else {
        return 'غير مسدد';
    }
}

/**
 * إنشاء تقرير الرسوم المدرسية (محدث مع التصفية)
 */
function generateFeesReport() {
    const dataToReport = filteredReportsData || db.getStudents();
    
    if (dataToReport.length === 0) {
        showAlert('لا توجد بيانات لإنشاء التقرير', 'warning');
        return;
    }
    
    generateFeesReportDocument(dataToReport);
}

/**
 * إنشاء تقرير الأقساط المتأخرة (محدث مع التصفية)
 */
function generateOverdueReport() {
    const allStudents = filteredReportsData || db.getStudents();
    
    // تصفية الطلاب المتأخرين في السداد
    const overdueStudents = allStudents.filter(student => {
        const fees = db.getStudentFees(student.id);
        const payments = db.getStudentPayments(student.id);
        const stats = calculateStudentStats(student, fees, payments);
        return stats.overdueAmount > 0 || (stats.remainingAmount > 0 && stats.totalPaid === 0);
    });
    
    if (overdueStudents.length === 0) {
        showAlert('لا توجد أقساط متأخرة في البيانات المحددة', 'info');
        return;
    }
    
    generateOverdueReportDocument(overdueStudents);
}

/**
 * إنشاء تقرير الخصومات (محدث مع التصفية)
 */
function generateDiscountsReport() {
    const allStudents = filteredReportsData || db.getStudents();
    
    // تصفية الطلاب الذين لديهم خصومات
    const studentsWithDiscounts = allStudents.filter(student => {
        const fees = db.getStudentFees(student.id);
        return fees && fees.discount_amount > 0;
    });
    
    if (studentsWithDiscounts.length === 0) {
        showAlert('لا توجد خصومات في البيانات المحددة', 'info');
        return;
    }
    
    generateDiscountsReportDocument(studentsWithDiscounts);
}

/**
 * إنشاء مستند تقرير الرسوم المدرسية
 */
function generateFeesReportDocument(studentsData) {
    const school = db.getSchoolSettings();
    const currentDate = new Date().toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    let totalFees = 0;
    let totalPaid = 0;
    let totalPending = 0;
    
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>تقرير الرسوم المدرسية</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                body {
                    font-family: 'Tajawal', Arial, sans-serif;
                    margin: 20px;
                    color: #333;
                    line-height: 1.6;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #4c51bf;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .school-name {
                    font-size: 24px;
                    font-weight: bold;
                    color: #4c51bf;
                    margin-bottom: 10px;
                }
                .report-title {
                    font-size: 20px;
                    color: #333;
                    margin-bottom: 5px;
                }
                .report-date {
                    color: #666;
                    font-size: 14px;
                }
                .summary {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 8px;
                    margin-bottom: 30px;
                    border: 1px solid #e9ecef;
                }
                .summary h3 {
                    color: #4c51bf;
                    margin-bottom: 15px;
                }
                .summary-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                }
                .summary-item {
                    text-align: center;
                    padding: 15px;
                    background: white;
                    border-radius: 6px;
                    border: 1px solid #dee2e6;
                }
                .summary-value {
                    font-size: 18px;
                    font-weight: bold;
                    color: #4c51bf;
                }
                .summary-label {
                    font-size: 12px;
                    color: #666;
                    margin-top: 5px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    background: white;
                }
                th, td {
                    border: 1px solid #dee2e6;
                    padding: 12px 8px;
                    text-align: center;
                    font-size: 12px;
                }
                th {
                    background: #4c51bf;
                    color: white;
                    font-weight: bold;
                }
                tr:nth-child(even) {
                    background: #f8f9fa;
                }
                .paid { color: #28a745; font-weight: bold; }
                .pending { color: #dc3545; font-weight: bold; }
                .partial { color: #ffc107; font-weight: bold; }
                @media print {
                    body { margin: 10px; }
                    .summary-grid { grid-template-columns: repeat(4, 1fr); }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="school-name">${school.name}</div>
                <div class="report-title">تقرير الرسوم المدرسية</div>
                <div class="report-date">تاريخ التقرير: ${currentDate}</div>
                ${filteredReportsData ? '<div style="color: #e53e3e; font-weight: bold; margin-top: 10px;">تقرير مفلتر</div>' : ''}
            </div>
            
            <div class="summary">
                <h3>ملخص الإحصائيات</h3>
                <div class="summary-grid" id="summary-grid">
                    <!-- سيتم ملء الإحصائيات هنا -->
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>رقم الطالب</th>
                        <th>اسم الطالب</th>
                        <th>الصف</th>
                        <th>نوع ولي الأمر</th>
                        <th>إجمالي الرسوم</th>
                        <th>المسدد</th>
                        <th>المتبقي</th>
                        <th>الحالة</th>
                    </tr>
                </thead>
                <tbody>
    `);
    
    studentsData.forEach(student => {
        const fees = db.getStudentFees(student.id);
        const payments = db.getStudentPayments(student.id);
        const stats = calculateStudentStats(student, fees, payments);
        
        totalFees += stats.totalFees;
        totalPaid += stats.totalPaid;
        totalPending += stats.remainingAmount;
        
        const status = getPaymentStatus(stats);
        const statusClass = status === 'مسدد' ? 'paid' : status === 'جزئي' ? 'partial' : 'pending';
        
        reportWindow.document.write(`
            <tr>
                <td>${student.student_number}</td>
                <td>${student.name}</td>
                <td>${student.grade}</td>
                <td>${student.guardian_type}</td>
                <td>${formatCurrency(stats.totalFees)}</td>
                <td>${formatCurrency(stats.totalPaid)}</td>
                <td>${formatCurrency(stats.remainingAmount)}</td>
                <td class="${statusClass}">${status}</td>
            </tr>
        `);
    });
    
    reportWindow.document.write(`
                </tbody>
            </table>
            
            <script>
                // إضافة الإحصائيات
                const summaryGrid = document.getElementById('summary-grid');
                summaryGrid.innerHTML = \`
                    <div class="summary-item">
                        <div class="summary-value">${studentsData.length}</div>
                        <div class="summary-label">عدد الطلاب</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value">${formatCurrency(totalFees)}</div>
                        <div class="summary-label">إجمالي الرسوم</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value">${formatCurrency(totalPaid)}</div>
                        <div class="summary-label">المبالغ المسددة</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-value">${formatCurrency(totalPending)}</div>
                        <div class="summary-label">المبالغ المتبقية</div>
                    </div>
                \`;
                
                setTimeout(() => {
                    window.print();
                }, 1000);
            </script>
        </body>
        </html>
    `);
    reportWindow.document.close();
}

/**
 * إنشاء مستند تقرير الأقساط المتأخرة
 */
function generateOverdueReportDocument(overdueStudents) {
    const school = db.getSchoolSettings();
    const currentDate = new Date().toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    let totalOverdue = 0;
    
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>تقرير الأقساط المتأخرة</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                body {
                    font-family: 'Tajawal', Arial, sans-serif;
                    margin: 20px;
                    color: #333;
                    line-height: 1.6;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #dc3545;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .school-name {
                    font-size: 24px;
                    font-weight: bold;
                    color: #dc3545;
                    margin-bottom: 10px;
                }
                .report-title {
                    font-size: 20px;
                    color: #333;
                    margin-bottom: 5px;
                }
                .warning-box {
                    background: #f8d7da;
                    border: 1px solid #f5c6cb;
                    color: #721c24;
                    padding: 15px;
                    border-radius: 8px;
                    margin-bottom: 20px;
                    text-align: center;
                    font-weight: bold;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    background: white;
                }
                th, td {
                    border: 1px solid #dee2e6;
                    padding: 12px 8px;
                    text-align: center;
                    font-size: 12px;
                }
                th {
                    background: #dc3545;
                    color: white;
                    font-weight: bold;
                }
                .overdue-row {
                    background: #f8d7da;
                }
                .overdue-amount {
                    color: #dc3545;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="school-name">${school.name}</div>
                <div class="report-title">تقرير الأقساط المتأخرة</div>
                <div class="report-date">تاريخ التقرير: ${currentDate}</div>
                ${filteredReportsData ? '<div style="color: #dc3545; font-weight: bold; margin-top: 10px;">تقرير مفلتر</div>' : ''}
            </div>
            
            <div class="warning-box">
                ⚠️ تنبيه: يوجد ${overdueStudents.length} طالب/طالبة متأخر في سداد الرسوم المدرسية
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>رقم الطالب</th>
                        <th>اسم الطالب</th>
                        <th>الصف</th>
                        <th>رقم الهاتف</th>
                        <th>إجمالي الرسوم</th>
                        <th>المسدد</th>
                        <th>المتبقي</th>
                        <th>المتأخرات</th>
                    </tr>
                </thead>
                <tbody>
    `);
    
    overdueStudents.forEach(student => {
        const fees = db.getStudentFees(student.id);
        const payments = db.getStudentPayments(student.id);
        const stats = calculateStudentStats(student, fees, payments);
        
        totalOverdue += stats.remainingAmount;
        
        reportWindow.document.write(`
            <tr class="overdue-row">
                <td>${student.student_number}</td>
                <td>${student.name}</td>
                <td>${student.grade}</td>
                <td>${student.phone}</td>
                <td>${formatCurrency(stats.totalFees)}</td>
                <td>${formatCurrency(stats.totalPaid)}</td>
                <td class="overdue-amount">${formatCurrency(stats.remainingAmount)}</td>
                <td class="overdue-amount">${formatCurrency(stats.overdueAmount)}</td>
            </tr>
        `);
    });
    
    reportWindow.document.write(`
                </tbody>
            </table>
            
            <div style="margin-top: 30px; text-align: center; font-size: 18px; font-weight: bold; color: #dc3545;">
                إجمالي المبالغ المتأخرة: ${formatCurrency(totalOverdue)}
            </div>
            
            <script>
                setTimeout(() => {
                    window.print();
                }, 1000);
            </script>
        </body>
        </html>
    `);
    reportWindow.document.close();
}

/**
 * إنشاء مستند تقرير الخصومات
 */
function generateDiscountsReportDocument(studentsWithDiscounts) {
    const school = db.getSchoolSettings();
    const currentDate = new Date().toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    let totalDiscounts = 0;
    
    const reportWindow = window.open('', '_blank');
    reportWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <title>تقرير الخصومات</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700&display=swap');
                body {
                    font-family: 'Tajawal', Arial, sans-serif;
                    margin: 20px;
                    color: #333;
                    line-height: 1.6;
                }
                .header {
                    text-align: center;
                    border-bottom: 2px solid #28a745;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .school-name {
                    font-size: 24px;
                    font-weight: bold;
                    color: #28a745;
                    margin-bottom: 10px;
                }
                .report-title {
                    font-size: 20px;
                    color: #333;
                    margin-bottom: 5px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    background: white;
                }
                th, td {
                    border: 1px solid #dee2e6;
                    padding: 12px 8px;
                    text-align: center;
                    font-size: 12px;
                }
                th {
                    background: #28a745;
                    color: white;
                    font-weight: bold;
                }
                .discount-amount {
                    color: #28a745;
                    font-weight: bold;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="school-name">${school.name}</div>
                <div class="report-title">تقرير الخصومات</div>
                <div class="report-date">تاريخ التقرير: ${currentDate}</div>
                ${filteredReportsData ? '<div style="color: #28a745; font-weight: bold; margin-top: 10px;">تقرير مفلتر</div>' : ''}
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>رقم الطالب</th>
                        <th>اسم الطالب</th>
                        <th>الصف</th>
                        <th>الرسوم الأصلية</th>
                        <th>قيمة الخصم</th>
                        <th>سبب الخصم</th>
                        <th>صافي الرسوم</th>
                    </tr>
                </thead>
                <tbody>
    `);
    
    studentsWithDiscounts.forEach(student => {
        const fees = db.getStudentFees(student.id);
        
        totalDiscounts += fees.discount_amount;
        
        reportWindow.document.write(`
            <tr>
                <td>${student.student_number}</td>
                <td>${student.name}</td>
                <td>${student.grade}</td>
                <td>${formatCurrency(fees.total_fees)}</td>
                <td class="discount-amount">${formatCurrency(fees.discount_amount)}</td>
                <td>${fees.discount_reason || 'غير محدد'}</td>
                <td>${formatCurrency(fees.net_fees)}</td>
            </tr>
        `);
    });
    
    reportWindow.document.write(`
                </tbody>
            </table>
            
            <div style="margin-top: 30px; text-align: center; font-size: 18px; font-weight: bold; color: #28a745;">
                إجمالي الخصومات الممنوحة: ${formatCurrency(totalDiscounts)}
            </div>
            
            <script>
                setTimeout(() => {
                    window.print();
                }, 1000);
            </script>
        </body>
        </html>
    `);
    reportWindow.document.close();
}
