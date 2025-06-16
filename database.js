/**
 * إدارة قاعدة البيانات المحلية للنظام
 * يستخدم localStorage لحفظ البيانات محلياً
 */

class DatabaseManager {
    constructor() {
        this.initializeDatabase();
    }

    /**
     * تهيئة قاعدة البيانات وإنشاء الجداول الأساسية
     */
    initializeDatabase() {
        // إنشاء جدول الطلاب
        if (!localStorage.getItem('students')) {
            localStorage.setItem('students', JSON.stringify([]));
        }

        // إنشاء جدول الرسوم والأقساط
        if (!localStorage.getItem('fees')) {
            localStorage.setItem('fees', JSON.stringify([]));
        }

        // إنشاء جدول المدفوعات
        if (!localStorage.getItem('payments')) {
            localStorage.setItem('payments', JSON.stringify([]));
        }

        // إنشاء جدول الخصومات
        if (!localStorage.getItem('discounts')) {
            localStorage.setItem('discounts', JSON.stringify([]));
        }

        // إنشاء جدول اشتراكات الباص
        if (!localStorage.getItem('bus_subscriptions')) {
            localStorage.setItem('bus_subscriptions', JSON.stringify([]));
        }

        // إنشاء جدول إعدادات المدرسة
        if (!localStorage.getItem('school_settings')) {
            const defaultSettings = {
                name: 'مدرسة النموذج الأهلية',
                phone: '+968 12345678',
                director: 'أحمد محمد الكندي',
                logo: null,
                academic_year: '2024-2025',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            localStorage.setItem('school_settings', JSON.stringify(defaultSettings));
            console.log('تم إنشاء إعدادات المدرسة الافتراضية:', defaultSettings);
        }

        // إنشاء جدول الموظفين
        if (!localStorage.getItem('employees')) {
            const defaultEmployee = {
                id: 1,
                name: 'مدير النظام',
                username: 'admin',
                password: 'admin123',
                role: 'admin'
            };
            localStorage.setItem('employees', JSON.stringify([defaultEmployee]));
        }

        // إنشاء متغير العداد للطلاب
        if (!localStorage.getItem('student_counter')) {
            localStorage.setItem('student_counter', '1');
        }
    }

    /**
     * إضافة طالب جديد
     */
    addStudent(studentData) {
        try {
            const students = this.getStudents();
            const studentCounter = parseInt(localStorage.getItem('student_counter'));
            
            const newStudent = {
                id: studentCounter,
                student_number: this.generateStudentNumber(),
                academic_year: studentData.academic_year,
                name: studentData.name,
                grade: studentData.grade,
                guardian_name: studentData.guardian_name,
                guardian_type: studentData.guardian_type,
                employee_name: studentData.employee_name || null,
                phone: studentData.phone,
                email: studentData.email || null,
                guardian_relation: studentData.guardian_relation,
                previous_debts: parseFloat(studentData.previous_debts) || 0,
                current_fees: parseFloat(studentData.current_fees),
                advance_payment: parseFloat(studentData.advance_payment) || 0,
                payment_method: studentData.payment_method,
                installments_count: parseInt(studentData.installments_count),
                first_installment_date: studentData.first_installment_date,
                discount_amount: parseFloat(studentData.discount_amount) || 0,
                discount_reason: studentData.discount_reason || null,
                bus_subscription: studentData.bus_subscription === 'نعم',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            students.push(newStudent);
            localStorage.setItem('students', JSON.stringify(students));
            localStorage.setItem('student_counter', (studentCounter + 1).toString());

            // إنشاء سجل الرسوم للطالب
            this.createFeesRecord(newStudent);

            return { success: true, student: newStudent };
        } catch (error) {
            console.error('خطأ في إضافة الطالب:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * إنشاء سجل الرسوم والأقساط للطالب
     */
    createFeesRecord(student) {
        const fees = this.getFees();
        const totalFees = student.current_fees + student.previous_debts;
        const netFees = totalFees - student.discount_amount;
        const remainingAfterAdvance = netFees - student.advance_payment;
        const installmentAmount = remainingAfterAdvance / student.installments_count;

        const feesRecord = {
            id: this.generateId('fees'),
            student_id: student.id,
            total_fees: totalFees,
            discount_amount: student.discount_amount,
            discount_reason: student.discount_reason,
            net_fees: netFees,
            advance_payment: student.advance_payment,
            remaining_amount: remainingAfterAdvance,
            installments_count: student.installments_count,
            installment_amount: installmentAmount,
            paid_installments: student.advance_payment > 0 ? 1 : 0,
            remaining_installments: student.advance_payment > 0 ? student.installments_count - 1 : student.installments_count,
            next_due_date: student.first_installment_date,
            status: remainingAfterAdvance <= 0 ? 'مكتمل' : 'معلق',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        fees.push(feesRecord);
        localStorage.setItem('fees', JSON.stringify(fees));

        // إنشاء سجل الدفعة المقدمة إذا كانت موجودة
        if (student.advance_payment > 0) {
            this.addPayment({
                student_id: student.id,
                amount: student.advance_payment,
                payment_method: student.payment_method,
                payment_type: 'دفعة مقدمة',
                notes: 'دفعة مقدمة عند التسجيل'
            });
        }
    }

    /**
     * إضافة دفعة جديدة
     */
    addPayment(paymentData) {
        try {
            const payments = this.getPayments();
            
            const newPayment = {
                id: this.generateId('payments'),
                student_id: paymentData.student_id,
                amount: parseFloat(paymentData.amount),
                payment_method: paymentData.payment_method,
                payment_type: paymentData.payment_type || 'قسط',
                notes: paymentData.notes || '',
                receipt_number: this.generateReceiptNumber(),
                payment_date: paymentData.payment_date || new Date().toISOString(),
                created_at: new Date().toISOString()
            };

            payments.push(newPayment);
            localStorage.setItem('payments', JSON.stringify(payments));

            // تحديث سجل الرسوم
            this.updateFeesAfterPayment(paymentData.student_id, parseFloat(paymentData.amount));

            return { success: true, payment: newPayment };
        } catch (error) {
            console.error('خطأ في إضافة الدفعة:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * تحديث سجل الرسوم بعد الدفع
     */
    updateFeesAfterPayment(studentId, paymentAmount) {
        const fees = this.getFees();
        const studentFees = fees.find(fee => fee.student_id === studentId);
        
        if (studentFees) {
            studentFees.remaining_amount -= paymentAmount;
            studentFees.paid_installments += 1;
            studentFees.remaining_installments = Math.max(0, studentFees.remaining_installments - 1);
            
            if (studentFees.remaining_amount <= 0) {
                studentFees.status = 'مكتمل';
            }
            
            studentFees.updated_at = new Date().toISOString();
            localStorage.setItem('fees', JSON.stringify(fees));
        }
    }

    /**
     * الحصول على جميع الطلاب
     */
    getStudents() {
        return JSON.parse(localStorage.getItem('students') || '[]');
    }

    /**
     * الحصول على طالب محدد
     */
    getStudent(studentId) {
        const students = this.getStudents();
        return students.find(student => student.id === studentId);
    }

    /**
     * الحصول على جميع سجلات الرسوم
     */
    getFees() {
        return JSON.parse(localStorage.getItem('fees') || '[]');
    }

    /**
     * الحصول على رسوم طالب محدد
     */
    getStudentFees(studentId) {
        const fees = this.getFees();
        return fees.find(fee => fee.student_id === studentId);
    }

    /**
     * الحصول على جميع المدفوعات
     */
    getPayments() {
        return JSON.parse(localStorage.getItem('payments') || '[]');
    }

    /**
     * الحصول على مدفوعات طالب محدد
     */
    getStudentPayments(studentId) {
        const payments = this.getPayments();
        return payments.filter(payment => payment.student_id === studentId);
    }

    /**
     * الحصول على إعدادات المدرسة
     */
    getSchoolSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('school_settings'));
            console.log('استرجاع إعدادات المدرسة من localStorage:', settings);
            return settings;
        } catch (error) {
            console.error('خطأ في استرجاع إعدادات المدرسة:', error);
            return null;
        }
    }

    /**
     * تحديث إعدادات المدرسة
     */
    updateSchoolSettings(settings) {
        try {
            const updatedSettings = {
                ...settings,
                updated_at: new Date().toISOString()
            };
            localStorage.setItem('school_settings', JSON.stringify(updatedSettings));
            console.log('تم حفظ إعدادات المدرسة في localStorage:', updatedSettings);
            return { success: true, settings: updatedSettings };
        } catch (error) {
            console.error('خطأ في حفظ إعدادات المدرسة:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * البحث في الطلاب
     */
    searchStudents(searchTerm, gradeFilter = '') {
        const students = this.getStudents();
        let filteredStudents = students;

        if (searchTerm) {
            filteredStudents = filteredStudents.filter(student => 
                student.name.includes(searchTerm) ||
                student.phone.includes(searchTerm) ||
                student.guardian_name.includes(searchTerm)
            );
        }

        if (gradeFilter) {
            filteredStudents = filteredStudents.filter(student => 
                student.grade === gradeFilter
            );
        }

        return filteredStudents;
    }

    /**
     * الحصول على إحصائيات لوحة التحكم
     */
    getDashboardStats() {
        const students = this.getStudents();
        const fees = this.getFees();
        const payments = this.getPayments();

        const totalStudents = students.length;
        let totalFees = 0;
        let totalPaid = 0;
        let totalOverdue = 0;
        let studentsWithOverdue = 0;

        // حساب الإحصائيات لكل طالب
        students.forEach(student => {
            const studentFees = fees.find(f => f.student_id === student.id);
            const studentPayments = payments.filter(p => p.student_id === student.id);
            const studentTotalFees = studentFees ? studentFees.net_fees : (student.current_fees || 0);
            const studentTotalPaid = studentPayments.reduce((sum, payment) => sum + payment.amount, 0);

            totalFees += studentTotalFees;
            totalPaid += studentTotalPaid;

            // حساب المتأخرات
            if (student.installments_count && student.first_installment_date && studentTotalFees > 0) {
                const installmentAmount = studentTotalFees / student.installments_count;
                const startDate = new Date(student.first_installment_date);
                const today = new Date();
                let studentOverdue = 0;

                for (let i = 0; i < student.installments_count; i++) {
                    const dueDate = new Date(startDate);
                    dueDate.setMonth(startDate.getMonth() + i);

                    if (dueDate < today) {
                        const installmentsPaidAmount = (i + 1) * installmentAmount;
                        if (studentTotalPaid < installmentsPaidAmount) {
                            const unpaidAmount = Math.min(installmentAmount, installmentsPaidAmount - studentTotalPaid);
                            studentOverdue += unpaidAmount;
                        }
                    }
                }

                if (studentOverdue > 0) {
                    totalOverdue += studentOverdue;
                    studentsWithOverdue++;
                }
            }
        });

        const totalPending = Math.max(0, totalFees - totalPaid);

        return {
            totalStudents,
            totalFees,
            totalPaid,
            totalPending,
            totalOverdue,
            studentsWithOverdue
        };
    }

    /**
     * تصدير البيانات
     */
    exportData() {
        return {
            students: this.getStudents(),
            fees: this.getFees(),
            payments: this.getPayments(),
            school_settings: this.getSchoolSettings()
        };
    }

    /**
     * استيراد البيانات
     */
    importData(data) {
        try {
            if (data.students) {
                localStorage.setItem('students', JSON.stringify(data.students));
            }
            if (data.fees) {
                localStorage.setItem('fees', JSON.stringify(data.fees));
            }
            if (data.payments) {
                localStorage.setItem('payments', JSON.stringify(data.payments));
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * إنشاء رقم طالب تلقائي
     */
    generateStudentNumber() {
        const year = new Date().getFullYear();
        const counter = localStorage.getItem('student_counter');
        return `${year}${counter.toString().padStart(4, '0')}`;
    }

    /**
     * إنشاء رقم سند استلام
     */
    generateReceiptNumber() {
        const now = new Date();
        const timestamp = now.getTime().toString().slice(-6);
        return `REC${timestamp}`;
    }

    /**
     * إنشاء معرف فريد
     */
    generateId(type) {
        const items = JSON.parse(localStorage.getItem(type) || '[]');
        return items.length > 0 ? Math.max(...items.map(item => item.id)) + 1 : 1;
    }

    /**
     * تحديث بيانات طالب
     */
    updateStudent(studentId, updateData) {
        try {
            const students = this.getStudents();
            const studentIndex = students.findIndex(student => student.id === studentId);
            
            if (studentIndex === -1) {
                return { success: false, error: 'الطالب غير موجود' };
            }

            students[studentIndex] = { ...students[studentIndex], ...updateData, updated_at: new Date().toISOString() };
            localStorage.setItem('students', JSON.stringify(students));

            return { success: true, student: students[studentIndex] };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * حذف طالب
     */
    deleteStudent(studentId) {
        try {
            const students = this.getStudents();
            const fees = this.getFees();
            const payments = this.getPayments();

            // حذف الطالب
            const filteredStudents = students.filter(student => student.id !== studentId);
            localStorage.setItem('students', JSON.stringify(filteredStudents));

            // حذف سجلات الرسوم المرتبطة
            const filteredFees = fees.filter(fee => fee.student_id !== studentId);
            localStorage.setItem('fees', JSON.stringify(filteredFees));

            // حذف سجلات المدفوعات المرتبطة
            const filteredPayments = payments.filter(payment => payment.student_id !== studentId);
            localStorage.setItem('payments', JSON.stringify(filteredPayments));

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * الحصول على الطلاب المتأخرين في السداد
     */
    getOverdueStudents() {
        const students = this.getStudents();
        const fees = this.getFees();
        const overdueStudents = [];

        students.forEach(student => {
            const studentFees = fees.find(fee => fee.student_id === student.id);
            if (studentFees && studentFees.remaining_amount > 0) {
                const nextDueDate = new Date(studentFees.next_due_date);
                const today = new Date();
                
                if (nextDueDate < today) {
                    overdueStudents.push({
                        ...student,
                        overdueAmount: studentFees.remaining_amount,
                        overdueDays: Math.floor((today - nextDueDate) / (1000 * 60 * 60 * 24))
                    });
                }
            }
        });

        return overdueStudents;
    }

    /**
     * إضافة اشتراك باص جديد
     */
    addBusSubscription(subscriptionData) {
        try {
            const subscriptions = this.getBusSubscriptions();
            
            // حساب تاريخ انتهاء الاشتراك
            const startDate = new Date(subscriptionData.start_date);
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + subscriptionData.months_count);
            
            const newSubscription = {
                id: this.generateId('bus_subscriptions'),
                student_id: subscriptionData.student_id,
                monthly_fee: parseFloat(subscriptionData.monthly_fee),
                start_date: subscriptionData.start_date,
                end_date: endDate.toISOString().split('T')[0],
                months_count: parseInt(subscriptionData.months_count),
                payment_method: subscriptionData.payment_method,
                notes: subscriptionData.notes || '',
                status: this.getBusSubscriptionStatus(endDate),
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            subscriptions.push(newSubscription);
            localStorage.setItem('bus_subscriptions', JSON.stringify(subscriptions));
            
            return { success: true, subscription: newSubscription };
        } catch (error) {
            console.error('خطأ في إضافة اشتراك الباص:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * الحصول على جميع اشتراكات الباص
     */
    getBusSubscriptions() {
        const subscriptions = JSON.parse(localStorage.getItem('bus_subscriptions') || '[]');
        
        // تحديث حالة الاشتراكات
        const updatedSubscriptions = subscriptions.map(subscription => {
            const endDate = new Date(subscription.end_date);
            subscription.status = this.getBusSubscriptionStatus(endDate);
            return subscription;
        });
        
        localStorage.setItem('bus_subscriptions', JSON.stringify(updatedSubscriptions));
        return updatedSubscriptions;
    }

    /**
     * الحصول على اشتراك باص محدد
     */
    getBusSubscription(subscriptionId) {
        const subscriptions = this.getBusSubscriptions();
        return subscriptions.find(sub => sub.id === subscriptionId);
    }

    /**
     * تجديد اشتراك باص
     */
    renewBusSubscription(subscriptionId, additionalMonths) {
        try {
            const subscriptions = this.getBusSubscriptions();
            const subscriptionIndex = subscriptions.findIndex(sub => sub.id === subscriptionId);
            
            if (subscriptionIndex === -1) {
                return { success: false, error: 'الاشتراك غير موجود' };
            }
            
            const subscription = subscriptions[subscriptionIndex];
            const currentEndDate = new Date(subscription.end_date);
            const newEndDate = new Date(currentEndDate);
            newEndDate.setMonth(newEndDate.getMonth() + additionalMonths);
            
            subscription.end_date = newEndDate.toISOString().split('T')[0];
            subscription.months_count += additionalMonths;
            subscription.status = this.getBusSubscriptionStatus(newEndDate);
            subscription.updated_at = new Date().toISOString();
            
            localStorage.setItem('bus_subscriptions', JSON.stringify(subscriptions));
            
            return { success: true, subscription: subscription };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * إلغاء اشتراك باص
     */
    cancelBusSubscription(subscriptionId) {
        try {
            const subscriptions = this.getBusSubscriptions();
            const filteredSubscriptions = subscriptions.filter(sub => sub.id !== subscriptionId);
            
            localStorage.setItem('bus_subscriptions', JSON.stringify(filteredSubscriptions));
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * تجديد جميع الاشتراكات النشطة
     */
    renewAllBusSubscriptions() {
        try {
            const subscriptions = this.getBusSubscriptions();
            let renewedCount = 0;
            
            subscriptions.forEach(subscription => {
                if (subscription.status === 'نشط') {
                    const currentEndDate = new Date(subscription.end_date);
                    const newEndDate = new Date(currentEndDate);
                    newEndDate.setMonth(newEndDate.getMonth() + 1);
                    
                    subscription.end_date = newEndDate.toISOString().split('T')[0];
                    subscription.months_count += 1;
                    subscription.status = this.getBusSubscriptionStatus(newEndDate);
                    subscription.updated_at = new Date().toISOString();
                    
                    renewedCount++;
                }
            });
            
            localStorage.setItem('bus_subscriptions', JSON.stringify(subscriptions));
            
            return { success: true, count: renewedCount };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * تحديد حالة اشتراك الباص
     */
    getBusSubscriptionStatus(endDate) {
        const today = new Date();
        const end = new Date(endDate);
        
        return end >= today ? 'نشط' : 'منتهي';
    }

    /**
     * الحصول على اشتراكات باص طالب محدد
     */
    getStudentBusSubscriptions(studentId) {
        const subscriptions = this.getBusSubscriptions();
        return subscriptions.filter(sub => sub.student_id === studentId);
    }

    /**
     * الحصول على جميع الموظفين
     */
    getEmployees() {
        const employees = localStorage.getItem('employees');
        return employees ? JSON.parse(employees) : [];
    }
    
    /**
     * إضافة موظف جديد
     */
    addEmployee(employeeData) {
        try {
            const employees = this.getEmployees();
            const newEmployee = {
                id: employees.length > 0 ? Math.max(...employees.map(e => e.id)) + 1 : 1,
                name: employeeData.name,
                username: employeeData.username,
                password: employeeData.password,
                role: employeeData.role || 'user',
                created_at: new Date().toISOString()
            };
            
            employees.push(newEmployee);
            localStorage.setItem('employees', JSON.stringify(employees));
            
            return { success: true, employee: newEmployee };
        } catch (error) {
            console.error('خطأ في إضافة الموظف:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * حذف طالب
     */
    deleteStudent(studentId) {
        try {
            const students = this.getStudents();
            const studentIndex = students.findIndex(s => s.id === studentId);
            
            if (studentIndex === -1) {
                return { success: false, error: 'الطالب غير موجود' };
            }
            
            // حذف الطالب
            students.splice(studentIndex, 1);
            localStorage.setItem('students', JSON.stringify(students));
            
            // حذف الرسوم المرتبطة
            const fees = this.getFees();
            const updatedFees = fees.filter(f => f.student_id !== studentId);
            localStorage.setItem('fees', JSON.stringify(updatedFees));
            
            // حذف المدفوعات المرتبطة
            const payments = this.getPayments();
            const updatedPayments = payments.filter(p => p.student_id !== studentId);
            localStorage.setItem('payments', JSON.stringify(updatedPayments));
            
            // حذف اشتراكات الباص المرتبطة
            const busSubscriptions = this.getBusSubscriptions();
            const updatedBusSubscriptions = busSubscriptions.filter(b => b.student_id !== studentId);
            localStorage.setItem('bus_subscriptions', JSON.stringify(updatedBusSubscriptions));
            
            return { success: true };
        } catch (error) {
            console.error('خطأ في حذف الطالب:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * حذف مدفوعة
     */
    deletePayment(paymentId) {
        try {
            const payments = this.getPayments();
            // تحويل المعرف إلى رقم للمقارنة
            const id = parseInt(paymentId);
            const paymentIndex = payments.findIndex(p => p.id === id);
            
            if (paymentIndex === -1) {
                console.warn('محاولة حذف مدفوعة غير موجودة:', paymentId, 'المدفوعات المتاحة:', payments.map(p => p.id));
                return { success: false, error: 'المدفوعة غير موجودة' };
            }
            
            const deletedPayment = payments[paymentIndex];
            payments.splice(paymentIndex, 1);
            localStorage.setItem('payments', JSON.stringify(payments));
            
            // تحديث سجل الرسوم بعد حذف الدفعة
            this.updateFeesAfterPaymentDeletion(deletedPayment.student_id, deletedPayment.amount);
            
            return { success: true, deletedPayment: deletedPayment };
        } catch (error) {
            console.error('خطأ في حذف المدفوعة:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * تحديث سجل الرسوم بعد حذف دفعة
     */
    updateFeesAfterPaymentDeletion(studentId, deletedAmount) {
        try {
            const fees = this.getFees();
            const studentFees = fees.find(f => f.student_id === studentId);
            
            if (studentFees) {
                studentFees.paid_amount = Math.max(0, (studentFees.paid_amount || 0) - deletedAmount);
                studentFees.remaining_amount = studentFees.net_fees - studentFees.paid_amount;
                studentFees.updated_at = new Date().toISOString();
                
                localStorage.setItem('fees', JSON.stringify(fees));
            }
        } catch (error) {
            console.error('خطأ في تحديث الرسوم بعد حذف الدفعة:', error);
        }
    }

    /**
     * تنظيف قاعدة البيانات
     */
    clearDatabase() {
        const keys = ['students', 'fees', 'payments', 'discounts', 'bus_subscriptions'];
        keys.forEach(key => {
            localStorage.setItem(key, JSON.stringify([]));
        });
        localStorage.setItem('student_counter', '1');
        
        return { success: true };
    }

    /**
     * إضافة مدفوعة باص
     */
    addBusPayment(paymentData) {
        try {
            const busPayments = this.getBusPayments();
            
            const newPayment = {
                id: paymentData.id || Date.now(),
                subscription_id: paymentData.subscription_id,
                student_id: paymentData.student_id,
                receipt_number: paymentData.receipt_number,
                amount: parseFloat(paymentData.amount),
                payment_method: paymentData.payment_method,
                payment_date: paymentData.payment_date,
                payment_type: paymentData.payment_type,
                notes: paymentData.notes,
                created_at: new Date().toISOString()
            };
            
            busPayments.push(newPayment);
            localStorage.setItem('bus_payments', JSON.stringify(busPayments));
            
            return { success: true, payment: newPayment };
        } catch (error) {
            console.error('خطأ في إضافة مدفوعة الباص:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * الحصول على جميع مدفوعات الباص
     */
    getBusPayments() {
        const data = localStorage.getItem('bus_payments');
        return data ? JSON.parse(data) : [];
    }

    /**
     * الحصول على مدفوعات باص طالب معين
     */
    getBusPaymentsByStudent(studentId) {
        const payments = this.getBusPayments();
        return payments.filter(payment => payment.student_id === studentId);
    }

    /**
     * الحصول على مدفوعة باص بالرقم
     */
    getBusPaymentByReceiptNumber(receiptNumber) {
        const payments = this.getBusPayments();
        return payments.find(payment => payment.receipt_number === receiptNumber);
    }
}

// إنشاء مثيل واحد من مدير قاعدة البيانات
const db = new DatabaseManager();
