// =========================================================================
// 🌐 ប្រព័ន្ធគ្រប់គ្រងទិន្នន័យ STATE & GLOBAL VARIABLES
// =========================================================================
let selectedGame = '';
let selectedDiamond = '';
let selectedPrice = '';
let checkStatusInterval = null;

// Variables សម្រាប់តាមដានការ Verify ការពារភ្ញៀវលួចប្ដូរ ID កាត់ក្រោយ
let isVerified = false;
let verifiedPlayerId = '';
let verifiedZoneId = '';

// 📦 ឃ្លាំងផ្ទុកទិន្នន័យប្ដូរតាមប្រភេទហ្គេម
const gameDatabase = {
    "Mobile Legends": {
        inputs: `
            <div class="input-field">
                <i class="fa fa-user"></i>
                <input type="number" id="playerId" placeholder="បញ្ចូល Player ID">
            </div>
            <div class="input-field" style="margin-top: 12px;">
                <i class="fa fa-layer-group"></i>
                <input type="number" id="zoneId" placeholder="Zone ID">
            </div>`,
        items: [
            { id: "mlbb_86", qty: "💎 86 Diamonds", price: "$1.50" },
            { id: "mlbb_257", qty: "💎 257 Diamonds", price: "$4.30" },
            { id: "mlbb_706", qty: "💎 706 Diamonds", price: "$11.50" },
            { id: "mlbb_1412", qty: "💎 1412 Diamonds", price: "$22.00" }
        ]
    },
    "PUBG Mobile": {
        inputs: `
            <div class="input-field">
                <i class="fa fa-user"></i>
                <input type="number" id="playerId" placeholder="បញ្ចូល Character ID">
            </div>`,
        items: [
            { id: "pubg_60", qty: "💵 60 UC", price: "$0.99" },
            { id: "pubg_325", qty: "💵 325 UC", price: "$4.99" },
            { id: "pubg_660", qty: "💵 660 UC", price: "$9.99" },
            { id: "pubg_1800", qty: "💵 1800 UC", price: "$24.99" }
        ]
    },
    "Free Fire": {
        inputs: `
            <div class="input-field">
                <i class="fa fa-user"></i>
                <input type="number" id="playerId" placeholder="បញ្ចូល Player ID (Free Fire)">
            </div>`,
        items: [
            { id: "ff_100", qty: "💎 100 Diamonds", price: "$1.00" },
            { id: "ff_210", qty: "💎 210 Diamonds", price: "$2.00" },
            { id: "ff_530", qty: "💎 530 Diamonds", price: "$5.00" },
            { id: "ff_1080", qty: "💎 1080 Diamonds", price: "$10.00" }
        ]
    }
};

// 🔄 ១. មុខងារបើកទំព័រ Top-up ឌីណាមិក (ពេលចុចលើរូបហ្គេមណាមួយ)
function openTopUp(gameName) {
    selectedGame = gameName;
    document.getElementById('currentGameName').textContent = gameName;
    
    document.getElementById('homePage').style.display = 'none';
    document.getElementById('topupPage').style.display = 'block';
    
    const game = gameDatabase[gameName] || {
        inputs: `<div class="input-field"><i class="fa fa-user"></i><input type="number" id="playerId" placeholder="បញ្ចូល Player ID"></div>`,
        items: [
            { id: "gen_1", qty: "📦 កញ្ចប់ធម្មតាទី១", price: "$1.00" },
            { id: "gen_2", qty: "📦 កញ្ចប់ធម្មតាទី២", price: "$5.00" }
        ]
    };

    document.getElementById('dynamic-inputs').innerHTML = game.inputs;

    let itemsHTML = '';
    game.items.forEach(item => {
        itemsHTML += `
            <div class="diamond-card" onclick="selectDiamond(this, '${item.id}', '${item.price}')">
                <div class="dm-amount">${item.qty}</div>
                <div class="dm-price">${item.price}</div>
            </div>`;
    });
    document.getElementById('dynamic-items').innerHTML = itemsHTML;

    // សម្អាតប្រព័ន្ធប្រកាសទិន្នន័យចាស់ និងប្រព័ន្ធវេរីហ្វាយចោលសិន
    selectedDiamond = '';
    selectedPrice = '';
    isVerified = false;
    verifiedPlayerId = '';
    verifiedZoneId = '';
    document.getElementById('verify-result').style.display = 'none';
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 💎 ២. មុខងារបញ្ជាពេលចុចលើកាតតម្លៃពេជ្រ
function selectDiamond(element, diamondId, price) {
    document.querySelectorAll('.diamond-card').forEach(c => c.classList.remove('active'));
    element.classList.add('active');
    selectedDiamond = diamondId;
    selectedPrice = price;
}

// 🔙 ៣. មុខងារបិទទំព័រត្រឡប់ទៅក្រោយវិញ
function closeTopUp() {
    document.getElementById('homePage').style.display = 'block';
    document.getElementById('topupPage').style.display = 'none';
    loadOrderHistory();
}

// =========================================================================
// 🌐 ដំណើរការប្រព័ន្ធរួមពេល Web ដើរពេញលេញ (CORE RUNTIME)
// =========================================================================
document.addEventListener('DOMContentLoaded', () => {
    
    loadOrderHistory();
    resetSliderTimer();
    startFlashSaleTimer();

    // ៤. មុខងារចុចប៊ូតុង ពិនិត្យឈ្មោះគណនី (VERIFY ACCOUNT SYSTEM)
    document.getElementById('btnVerify').addEventListener('click', async () => {
        const playerIdInput = document.getElementById('playerId');
        const zoneIdInput = document.getElementById('zoneId');
        
        const playerId = playerIdInput ? playerIdInput.value.trim() : '';
        const zoneId = zoneIdInput ? zoneIdInput.value.trim() : '';

        if (!playerId) return alert('សូមបញ្ចូលលេខសម្គាល់គណនី (Player ID) ជាមុនសិន!');
        if (selectedGame === 'Mobile Legends' && !zoneId) {
            return alert('សូមបញ្ចូលលេខតំបន់ (Zone ID) របស់ Mobile Legends!');
        }

        const btnVerify = document.getElementById('btnVerify');
        btnVerify.disabled = true;
        btnVerify.innerHTML = '⏳ កំពុងពិនិត្យឈ្មោះគណនី...';

        try {
            // 🚀 ផ្ញើទៅកាន់ API Verify របស់ backend (ឧទហរណ៍៖ /api/games/verify)
            const res = await fetch('/api/games/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    game: selectedGame,
                    playerId: playerId,
                    zoneId: zoneId
                })
            });

            const data = await res.json();
            
            if (data.success) {
                document.getElementById('verifiedNickname').textContent = data.nickname;
                document.getElementById('verify-result').style.display = 'block';
                
                // កត់សម្គាល់ទុកថាបាន Verify ជោគជ័យ
                isVerified = true;
                verifiedPlayerId = playerId;
                verifiedZoneId = zoneId;
            } else {
                alert(data.message || 'រកមិនឃើញគណនីនេះទេ! សូមពិនិត្យមើល ID ឡើងវិញ។');
                isVerified = false;
                document.getElementById('verify-result').style.display = 'none';
            }
        } catch (error) {
            // 💡 សម្គាល់៖ បើបងចង់តេស្តសាកល្បងនៅលើ Frontend (ដោយមិនទាន់មាន API Backend ពិតប្រាកដ) 
            // បងអាចបើក (Uncomment) កូដ ៥ បន្ទាត់ខាងក្រោមនេះ ដើម្បីឱ្យវាបង្ហាញឈ្មោះសាកល្បងបាន៖
            /*
            document.getElementById('verifiedNickname').textContent = "FONG_GAMER_✨";
            document.getElementById('verify-result').style.display = 'block';
            isVerified = true;
            verifiedPlayerId = playerId;
            verifiedZoneId = zoneId;
            return btnVerify.innerHTML = '<i class="fa fa-search"></i> ពិនិត្យឈ្មោះគណនី (Verify Name)';
            */
            
            alert('មានបញ្ហាដាច់ការតភ្ជាប់ជាមួយ Server ក្នុងការឆែកឈ្មោះ!');
        } finally {
            if (btnVerify.disabled) {
                btnVerify.disabled = false;
                btnVerify.innerHTML = '<i class="fa fa-search"></i> ពិនិត្យឈ្មោះគណនី (Verify Name)';
            }
        }
    });

    // ៥. ប៊ូតុងរបារខាងក្រោម (Bottom Navigation)
    const navItems = document.querySelectorAll('.bottom-nav .nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            const txt = item.querySelector('span').innerText;
            if(txt === 'Home' || txt === 'Beranda') {
                closeTopUp();
            }
        });
    });

    // ៦. ចុចប៊ូតុងបញ្ជាទិញ (Submit Order)
    document.getElementById('btnSubmit').addEventListener('click', async () => {
        const playerIdInput = document.getElementById('playerId');
        const zoneIdInput = document.getElementById('zoneId');
        
        const playerId = playerIdInput ? playerIdInput.value.trim() : '';
        const zoneId = zoneIdInput ? zoneIdInput.value.trim() : '';

        // 🛡️ ឆែកប្រព័ន្ធសុវត្ថិភាពផ្ទៀងផ្ទាត់ឈ្មោះមុននឹងទិញ
        if (!isVerified || playerId !== verifiedPlayerId || zoneId !== verifiedZoneId) {
            return alert('សូមចុចប៊ូតុង "ពិនិត្យឈ្មោះគណនី" ដើម្បីផ្ទៀងផ្ទាត់ឈ្មោះឱ្យបានត្រឹមត្រូវជាមុនសិន!');
        }
        if (!selectedDiamond) return alert('សូមជ្រើសរើសកញ្ចប់ពេជ្រដែលចង់បាន!');

        const btnSubmit = document.getElementById('btnSubmit');
        btnSubmit.disabled = true;
        btnSubmit.innerText = '⏳ កំពុងបង្កើតការកុម្ម៉ង់...';

        try {
            const res = await fetch('/api/orders/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    game: selectedGame,
                    playerId: playerId,
                    zoneId: selectedGame === 'Mobile Legends' ? zoneId : '',
                    diamond: selectedDiamond,
                    price: selectedPrice
                })
            });
            
            const data = await res.json();
            if (data.success) {
                document.getElementById('modalGame').textContent = data.order.game;
                document.getElementById('modalDiamond').textContent = data.order.diamond;
                document.getElementById('modalPrice').textContent = data.order.price;
                document.getElementById('paymentModal').style.display = 'flex';
                startPollingStatus(data.order.id);
            }
        } catch (error) {
            alert('មានបញ្ហាដាច់ការតភ្ជាប់ជាមួយ Server!');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerText = 'Top Up Now';
        }
    });

    // ៧. ឆែកមើលស្ថានភាពលុយ (Polling)
    function startPollingStatus(orderId) {
        if (checkStatusInterval) clearInterval(checkStatusInterval);
        const btnConfirm = document.getElementById('btnConfirmPayment');
        
        checkStatusInterval = setInterval(async () => {
            try {
                const res = await fetch(`/api/orders/status/${orderId}`);
                const data = await res.json();
                
                if (data.status === 'Pending') {
                    btnConfirm.innerText = '⏳ រង់ចាំការស្កែនទូទាត់ប្រាក់ (Waiting...)';
                } else if (data.status === 'Processing') {
                    btnConfirm.innerText = '🤖 ទទួលបានលុយហើយ! កំពុងបុកហ្គេម...';
                    btnConfirm.style.backgroundColor = '#fbbf24';
                    btnConfirm.style.color = '#000';
                } else if (data.status === 'Completed') {
                    clearInterval(checkStatusInterval);
                    btnConfirm.innerText = '✅ បុកហ្គេមជោគជ័យពេញលេញ!';
                    btnConfirm.style.backgroundColor = '#10b981';
                    btnConfirm.style.color = '#fff';
                    setTimeout(() => {
                        document.getElementById('paymentModal').style.display = 'none';
                        closeTopUp();
                    }, 1500);
                }
            } catch (err) { console.error(err); }
        }, 2000);
    }

    // ៨. ទាញយកប្រវត្តិការទិញ
    async function loadOrderHistory() {
        const tbody = document.getElementById('orderHistory');
        if (!tbody) return;
        try {
            const res = await fetch('/api/orders');
            const orders = await res.json();
            tbody.innerHTML = '';
            orders.reverse().slice(0, 5).forEach(order => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${order.game}</strong></td>
                    <td>${order.playerId} ${order.zoneId && order.zoneId !== 'N/A' ? `(${order.zoneId})` : ''}</td>
                    <td style="color:#10b981;">${order.price}</td>
                    <td><span class="status-${order.status.toLowerCase()}">${order.status}</span></td>
                `;
                tbody.appendChild(tr);
            });
        } catch (e) {}
    }

    document.getElementById('closeModal').addEventListener('click', () => {
        document.getElementById('paymentModal').style.display = 'none';
        if (checkStatusInterval) clearInterval(checkStatusInterval);
    });
});

// =========================================================================
// 🎠 ប្រព័ន្ធបញ្ជា BANNER SLIDER
// =========================================================================
let currentSlideIndex = 0;
let slideIntervalTimer;

function showBannerSlides(index) {
    const slides = document.querySelectorAll('.banner-slide');
    const dots = document.querySelectorAll('.banner-dots .dot');
    
    if (slides.length === 0) return; 
    
    if (index >= slides.length) { currentSlideIndex = 0; }
    else if (index < 0) { currentSlideIndex = slides.length - 1; }
    else { currentSlideIndex = index; }
    
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    
    if (slides[currentSlideIndex]) slides[currentSlideIndex].classList.add('active');
    if (dots[currentSlideIndex]) dots[currentSlideIndex].classList.add('active');
}

function nextBannerSlide() {
    currentSlideIndex++;
    showBannerSlides(currentSlideIndex);
}

function currentSlide(index) {
    currentSlideIndex = index;
    showBannerSlides(currentSlideIndex);
    resetSliderTimer();
}

function resetSliderTimer() {
    clearInterval(slideIntervalTimer);
    slideIntervalTimer = setInterval(nextBannerSlide, 4000);
}

// =========================================================================
// ⏰ ប្រព័ន្ធរាប់ថយក្រោយ FLASH SALE
// =========================================================================
const COUNTDOWN_DURATION = 12600; 
let timeLeft = COUNTDOWN_DURATION;

function startFlashSaleTimer() {
    const hoursEl = document.getElementById('flash-hours');
    const minutesEl = document.getElementById('flash-minutes');
    const secondsEl = document.getElementById('flash-seconds');

    if (!hoursEl || !minutesEl || !secondsEl) return;

    setInterval(() => {
        let hrs = Math.floor(timeLeft / 3600);
        let mins = Math.floor((timeLeft % 3600) / 60);
        let secs = timeLeft % 60;

        hoursEl.textContent = hrs < 10 ? '0' + hrs : hrs;
        minutesEl.textContent = mins < 10 ? '0' + mins : mins;
        secondsEl.textContent = secs < 10 ? '0' + secs : secs;

        if (timeLeft === 0) {
            timeLeft = COUNTDOWN_DURATION;
        } else {
            timeLeft--;
        }
    }, 1000);
}
