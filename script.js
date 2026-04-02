// --- STATE MANAGEMENT ---
// Initialize mock data or load from localStorage
const initialState = {
    patients: [
        { id: "PT001", name: "Rahul Sharma", age: 45, gender: "Male", contact: "9876543210", disease: "Hypertension" },
        { id: "PT002", name: "Priya Singh", age: 32, gender: "Female", contact: "8765432109", disease: "Viral Fever" },
    ],
    medicines: [
        { id: "M001", name: "Paracetamol 500mg", company: "GSK", price: "15.00", expiry: "2025-12-10" },
        { id: "M002", name: "Amoxicillin 250mg", company: "Cipla", price: "45.50", expiry: "2024-08-15" },
    ],
    bills: [],
    stock: [
        { id: "S001", name: "Paracetamol 500mg", qty: 450, status: "normal" },
        { id: "S002", name: "Amoxicillin 250mg", qty: 25, status: "low" },
    ]
};

// State Store
const store = {
    data: JSON.parse(localStorage.getItem('medical-storage')) || initialState,
    
    save() {
        localStorage.setItem('medical-storage', JSON.stringify(this.data));
        // Re-render UI after state change
        app.renderDashboard();
        app.renderPatients();
        app.renderMedicines();
        app.renderStock();
        app.renderBilling();
        app.renderReports();
    },
    
    addPatient(patient) {
        const id = `PT${(this.data.patients.length + 1).toString().padStart(3, '0')}`;
        this.data.patients.push({ ...patient, id });
        this.save();
    },
    
    addMedicine(medicine, initialQty) {
        const id = `M${(this.data.medicines.length + 1).toString().padStart(3, '0')}`;
        this.data.medicines.push({ ...medicine, id });
        
        // Add to stock
        const stockId = `S${(this.data.stock.length + 1).toString().padStart(3, '0')}`;
        let status = 'normal';
        if (initialQty <= 10) status = 'critical';
        else if (initialQty <= 50) status = 'low';
        
        this.data.stock.push({ id: stockId, name: medicine.name, qty: parseInt(initialQty), status });
        this.save();
    },
    
    addBill(bill) {
        const id = `B${(this.data.bills.length + 1).toString().padStart(3, '0')}`;
        const newBill = { 
            ...bill, 
            id, 
            date: new Date().toISOString() 
        };
        this.data.bills.push(newBill);
        
        // Reduce stock for each item
        bill.items.forEach(item => {
            this.updateStock(item.name, -item.quantity);
        });
        
        this.save();
        return newBill;
    },
    
    updateStock(medicineName, quantityChange) {
        this.data.stock = this.data.stock.map(item => {
            if (item.name === medicineName) {
                const newQty = Math.max(0, item.qty + parseInt(quantityChange));
                let status = 'normal';
                if (newQty <= 10) status = 'critical';
                else if (newQty <= 50) status = 'low';
                else if (newQty >= 500) status = 'high';
                return { ...item, qty: newQty, status };
            }
            return item;
        });
        this.save();
    }
};

// --- APP LOGIC ---
const app = {
    currentBillItems: [],
    
    init() {
        // Setup Navigation
        this.setupNavigation();
        
        // Setup Forms
        this.setupForms();
        
        // Initial Render
        this.renderDashboard();
        this.renderPatients();
        this.renderMedicines();
        this.renderStock();
        this.renderBilling();
        this.renderReports();
        
        // Setup Billing logic
        this.setupBillingLogic();
    },
    
    setupNavigation() {
        // Sidebar toggles for mobile
        document.getElementById('open-sidebar').addEventListener('click', () => {
            document.getElementById('sidebar').classList.add('open');
        });
        
        document.getElementById('close-sidebar').addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
        });
        
        // Navigation links
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const pageId = item.getAttribute('data-page');
                this.navigateTo(pageId);
                
                // Close sidebar on mobile after navigation
                if (window.innerWidth <= 768) {
                    document.getElementById('sidebar').classList.remove('open');
                }
            });
        });
    },
    
    navigateTo(pageId) {
        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.getAttribute('data-page') === pageId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        
        // Show correct page
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(`page-${pageId}`).classList.add('active');
        
        // Ensure data is fresh
        if (pageId === 'billing') {
            this.populateBillingDropdowns();
            this.currentBillItems = [];
            this.renderBillItems();
        }
    },
    
    setupForms() {
        // Patient Form
        document.getElementById('patient-form').addEventListener('submit', (e) => {
            e.preventDefault();
            store.addPatient({
                name: document.getElementById('p-name').value,
                age: parseInt(document.getElementById('p-age').value),
                gender: document.getElementById('p-gender').value,
                contact: document.getElementById('p-contact').value,
                disease: document.getElementById('p-disease').value
            });
            document.getElementById('patient-modal').classList.remove('active');
            e.target.reset();
        });
        
        // Medicine Form
        document.getElementById('medicine-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const initialQty = document.getElementById('m-qty').value;
            store.addMedicine({
                name: document.getElementById('m-name').value,
                company: document.getElementById('m-company').value,
                price: parseFloat(document.getElementById('m-price').value).toFixed(2),
                expiry: document.getElementById('m-expiry').value
            }, initialQty);
            document.getElementById('medicine-modal').classList.remove('active');
            e.target.reset();
        });
        
        // Stock Form
        document.getElementById('stock-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const medName = document.getElementById('s-med-name').value;
            const change = parseInt(document.getElementById('s-change').value);
            
            if (change !== 0) {
                store.updateStock(medName, change);
            }
            document.getElementById('stock-modal').classList.remove('active');
            e.target.reset();
        });
    },
    
    // --- RENDERERS ---
    
    renderDashboard() {
        const { patients, medicines, stock, bills } = store.data;
        
        // Stats
        const lowStockCount = stock.filter(item => item.status === 'low' || item.status === 'critical').length;
        const totalSalesToday = bills.reduce((sum, b) => sum + b.totalAmount, 0);
        
        document.getElementById('stat-patients').textContent = patients.length;
        document.getElementById('stat-medicines').textContent = medicines.length;
        document.getElementById('stat-medicines-trend').textContent = `${stock.length} inventory items`;
        document.getElementById('stat-sales').textContent = `₹${totalSalesToday.toFixed(0)}`;
        document.getElementById('stat-sales-trend').textContent = `${bills.length} bills generated`;
        document.getElementById('stat-low-stock').textContent = lowStockCount;
        
        const stockIcon = document.getElementById('stat-stock-icon');
        const stockTrend = document.getElementById('stat-low-stock-trend');
        
        if (lowStockCount > 0) {
            stockIcon.className = "stat-icon bg-amber-100 text-amber-600";
            stockTrend.textContent = "Requires attention";
            document.getElementById('stat-low-stock').style.color = "var(--warning)";
        } else {
            stockIcon.className = "stat-icon bg-emerald-100 text-emerald-600";
            stockTrend.textContent = "All good";
            document.getElementById('stat-low-stock').style.color = "inherit";
        }
        
        // Recent Activity
        const activityList = document.getElementById('recent-activity-list');
        
        if (bills.length === 0 && patients.length <= 2) {
            activityList.innerHTML = '<div class="empty-state">No recent activity to show.</div>';
        } else {
            const activities = [
                ...bills.map(b => ({ 
                    action: "Bill Generated", 
                    subject: b.patientName, 
                    time: new Date(b.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 
                    type: 'billing' 
                })),
                ...patients.slice(-2).map(p => ({ 
                    action: "Patient Registered", 
                    subject: p.name, 
                    time: "Recently", 
                    type: 'patient' 
                }))
            ].sort(() => Math.random() - 0.5).slice(0, 4); // Fake random sorting for recent items
            
            activityList.innerHTML = activities.map(act => {
                let iconClass, icon;
                if (act.type === 'billing') {
                    iconClass = "bg-violet-100 text-violet-600";
                    icon = "fa-file-invoice-dollar";
                } else if (act.type === 'patient') {
                    iconClass = "bg-blue-100 text-blue-600";
                    icon = "fa-user";
                } else {
                    iconClass = "bg-amber-100 text-amber-600";
                    icon = "fa-box";
                }
                
                return `
                    <div class="activity-item">
                        <div class="activity-icon ${iconClass}">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div>
                            <div class="activity-title">${act.action}</div>
                            <div class="activity-desc">${act.subject} • ${act.time}</div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    },
    
    renderPatients() {
        const tbody = document.querySelector('#patients-table tbody');
        if (store.data.patients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No patients found</td></tr>';
            return;
        }
        
        tbody.innerHTML = store.data.patients.map(p => `
            <tr>
                <td class="font-medium">${p.id}</td>
                <td>${p.name}</td>
                <td>${p.age} / ${p.gender.charAt(0)}</td>
                <td>${p.contact}</td>
                <td>${p.disease}</td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="app.newBillForPatient('${p.id}')">
                        Bill
                    </button>
                </td>
            </tr>
        `).join('');
    },
    
    renderMedicines() {
        const tbody = document.querySelector('#medicines-table tbody');
        if (store.data.medicines.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No medicines found</td></tr>';
            return;
        }
        
        tbody.innerHTML = store.data.medicines.map(m => `
            <tr>
                <td class="font-medium">${m.id}</td>
                <td>${m.name}</td>
                <td>${m.company}</td>
                <td>₹${m.price}</td>
                <td>${m.expiry}</td>
            </tr>
        `).join('');
    },
    
    renderStock() {
        const tbody = document.querySelector('#stock-table tbody');
        if (store.data.stock.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No stock items found</td></tr>';
            return;
        }
        
        tbody.innerHTML = store.data.stock.map(s => {
            let badgeClass = '';
            let statusText = s.status;
            
            if (s.status === 'normal' || s.status === 'high') badgeClass = 'badge-normal';
            else if (s.status === 'low') badgeClass = 'badge-low';
            else if (s.status === 'critical') badgeClass = 'badge-critical';
            
            return `
                <tr>
                    <td class="font-medium">${s.id}</td>
                    <td>${s.name}</td>
                    <td class="font-bold">${s.qty}</td>
                    <td><span class="badge ${badgeClass}">${statusText.charAt(0).toUpperCase() + statusText.slice(1)}</span></td>
                    <td>
                        <button class="btn btn-outline btn-sm" onclick="app.openStockModal('${s.name}', ${s.qty})">
                            Update
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },
    
    renderBilling() {
        const tbody = document.querySelector('#bills-table tbody');
        if (store.data.bills.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No bills generated yet</td></tr>';
            return;
        }
        
        // Sort bills newest first
        const sortedBills = [...store.data.bills].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        tbody.innerHTML = sortedBills.map(b => `
            <tr>
                <td class="font-medium">${b.id}</td>
                <td>${new Date(b.date).toLocaleString()}</td>
                <td>${b.patientName}</td>
                <td class="font-bold">₹${b.totalAmount.toFixed(2)}</td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="app.viewBill('${b.id}')">
                        <i class="fa-solid fa-eye"></i> View
                    </button>
                </td>
            </tr>
        `).join('');
    },
    
    renderReports() {
        const { patients, medicines, bills, stock } = store.data;
        
        // Stats
        const totalRevenue = bills.reduce((sum, b) => sum + b.totalAmount, 0);
        document.getElementById('report-revenue').textContent = `₹${totalRevenue.toFixed(2)}`;
        document.getElementById('report-bills').textContent = bills.length;
        document.getElementById('report-patients').textContent = patients.length;
        document.getElementById('report-medicines').textContent = medicines.length;
        
        // Alerts
        const alertsList = document.getElementById('report-stock-alerts');
        const lowStock = stock.filter(item => item.status === 'low' || item.status === 'critical');
        
        if (lowStock.length === 0) {
            alertsList.innerHTML = '<div class="empty-state">No stock alerts. All inventory levels are healthy.</div>';
        } else {
            alertsList.innerHTML = lowStock.map(item => `
                <div class="stock-alert-item ${item.status === 'critical' ? 'critical' : ''}">
                    <div>
                        <div class="font-medium">${item.name}</div>
                        <div class="text-xs text-muted mt-1">Current Quantity: ${item.qty}</div>
                    </div>
                    <span class="badge ${item.status === 'critical' ? 'badge-critical' : 'badge-low'}">
                        ${item.status.toUpperCase()}
                    </span>
                </div>
            `).join('');
        }
    },
    
    // --- SPECIFIC ACTIONS ---
    
    openStockModal(medName, currentQty) {
        document.getElementById('s-med-name').value = medName;
        document.getElementById('s-med-display-name').textContent = `Medicine: ${medName}`;
        document.getElementById('s-current-qty').textContent = currentQty;
        document.getElementById('s-change').value = "0";
        document.getElementById('stock-modal').classList.add('active');
    },
    
    newBillForPatient(patientId) {
        this.navigateTo('billing');
        document.getElementById('billing-modal').classList.add('active');
        
        // Select patient in dropdown
        setTimeout(() => {
            const select = document.getElementById('b-patient');
            for(let i=0; i<select.options.length; i++) {
                if(select.options[i].value === patientId) {
                    select.selectedIndex = i;
                    break;
                }
            }
        }, 100);
    },
    
    setupBillingLogic() {
        // Add item to bill
        document.getElementById('btn-add-item').addEventListener('click', () => {
            const medSelect = document.getElementById('b-medicine');
            const qtyInput = document.getElementById('b-qty');
            
            const medId = medSelect.value;
            const qty = parseInt(qtyInput.value);
            
            if (!medId || qty <= 0) return;
            
            const medicine = store.data.medicines.find(m => m.id === medId);
            if (!medicine) return;
            
            // Check stock
            const stockItem = store.data.stock.find(s => s.name === medicine.name);
            if (!stockItem || stockItem.qty < qty) {
                alert(`Insufficient stock! Only ${stockItem ? stockItem.qty : 0} available.`);
                return;
            }
            
            const price = parseFloat(medicine.price);
            
            // Check if already in list
            const existingIdx = this.currentBillItems.findIndex(i => i.medId === medId);
            if (existingIdx >= 0) {
                this.currentBillItems[existingIdx].quantity += qty;
                this.currentBillItems[existingIdx].total = this.currentBillItems[existingIdx].quantity * price;
            } else {
                this.currentBillItems.push({
                    medId: medicine.id,
                    name: medicine.name,
                    price: price,
                    quantity: qty,
                    total: price * qty
                });
            }
            
            this.renderBillItems();
            qtyInput.value = 1;
        });
        
        // Save Bill
        document.getElementById('btn-save-bill').addEventListener('click', () => {
            if (this.currentBillItems.length === 0) return;
            
            const patientId = document.getElementById('b-patient').value;
            const patient = store.data.patients.find(p => p.id === patientId);
            
            if (!patient) return;
            
            const totalAmount = this.currentBillItems.reduce((sum, item) => sum + item.total, 0);
            
            const newBill = store.addBill({
                patientId: patient.id,
                patientName: patient.name,
                items: [...this.currentBillItems],
                totalAmount
            });
            
            document.getElementById('billing-modal').classList.remove('active');
            this.currentBillItems = [];
            
            // Auto view the new bill
            this.viewBill(newBill.id);
        });
    },
    
    populateBillingDropdowns() {
        const patientSelect = document.getElementById('b-patient');
        patientSelect.innerHTML = store.data.patients.map(p => 
            `<option value="${p.id}">${p.name} - ${p.id}</option>`
        ).join('');
        
        const medSelect = document.getElementById('b-medicine');
        medSelect.innerHTML = store.data.medicines.map(m => 
            `<option value="${m.id}">${m.name} (₹${m.price})</option>`
        ).join('');
    },
    
    renderBillItems() {
        const tbody = document.querySelector('#bill-items-table tbody');
        const saveBtn = document.getElementById('btn-save-bill');
        
        if (this.currentBillItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No items added yet</td></tr>';
            document.getElementById('b-total').textContent = '₹0.00';
            saveBtn.disabled = true;
            return;
        }
        
        let total = 0;
        tbody.innerHTML = this.currentBillItems.map((item, index) => {
            total += item.total;
            return `
                <tr>
                    <td>${item.name}</td>
                    <td>₹${item.price.toFixed(2)}</td>
                    <td>${item.quantity}</td>
                    <td>₹${item.total.toFixed(2)}</td>
                    <td>
                        <button class="btn-icon text-danger" onclick="app.removeBillItem(${index})">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
        
        document.getElementById('b-total').textContent = `₹${total.toFixed(2)}`;
        saveBtn.disabled = false;
    },
    
    removeBillItem(index) {
        this.currentBillItems.splice(index, 1);
        this.renderBillItems();
    },
    
    viewBill(billId) {
        const bill = store.data.bills.find(b => b.id === billId);
        if (!bill) return;
        
        document.getElementById('v-patient').textContent = bill.patientName;
        document.getElementById('v-bill-id').textContent = bill.id;
        document.getElementById('v-date').textContent = new Date(bill.date).toLocaleString();
        
        document.getElementById('v-items').innerHTML = bill.items.map(item => `
            <tr>
                <td class="py-2">${item.name}</td>
                <td class="text-right py-2">₹${item.price.toFixed(2)}</td>
                <td class="text-right py-2">${item.quantity}</td>
                <td class="text-right py-2">₹${item.total.toFixed(2)}</td>
            </tr>
        `).join('');
        
        document.getElementById('v-total').textContent = `₹${bill.totalAmount.toFixed(2)}`;
        
        document.getElementById('bill-view-modal').classList.add('active');
    }
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
