// Глобальні змінні стану
let inventoryData = [];
let cart = {};
let currentCategory = 'Усі';

// Ініціалізація
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('player-avatar').src = `https://crafatar.com/avatars/${CONFIG.USERNAME}?overlay=true`;
    loadData();
    setupEventListeners();
});

// Завантаження даних з Google Sheets через PapaParse
function loadData() {
    Papa.parse(CONFIG.CSV_URL, {
        download: true,
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            inventoryData = results.data;
            renderCategories();
            renderItems(inventoryData);
        },
        error: function(err) {
            document.getElementById('items-grid').innerHTML = '<div class="loading" style="color:#ff5555">Помилка завантаження складу.</div>';
        }
    });
}

// Рендер категорій
function renderCategories() {
    const container = document.getElementById('categories-container');
    const categories = ['Усі', ...new Set(inventoryData.map(item => item.category).filter(Boolean))];
    
    container.innerHTML = categories.map(cat => 
        `<button class="mc-button category-btn ${cat === 'Усі' ? 'active' : ''}" data-cat="${cat}">${cat}</button>`
    ).join('');

    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentCategory = e.target.dataset.cat;
            filterItems();
        });
    });
}

// Фільтрація та пошук
function filterItems() {
    const query = document.getElementById('search-input').value.toLowerCase();
    const filtered = inventoryData.filter(item => {
        const matchCat = currentCategory === 'Усі' || item.category === currentCategory;
        const matchSearch = item.name.toLowerCase().includes(query);
        return matchCat && matchSearch;
    });
    renderItems(filtered);
}

document.getElementById('search-input').addEventListener('input', filterItems);

// Відображення карток товарів
function renderItems(items) {
    const grid = document.getElementById('items-grid');
    if (items.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center;">Нічого не знайдено</div>';
        return;
    }

    grid.innerHTML = items.map(item => {
        const stock = parseInt(item.stock) || 0;
        const priceDia = parseInt(item.price_diamonds) || 0;
        const priceOre = (priceDia / CONFIG.CURRENCY_RATE).toFixed(1).replace('.0', '');
        const isOutOfStock = stock <= 0;
        const imgUrl = `${CONFIG.ASSETS_URL}${item.id}.png`;

        return `
            <div class="item-card ${isOutOfStock ? 'out-of-stock' : ''}">
                ${item.is_sale && item.is_sale.toUpperCase() === 'TRUE' ? '<div class="sale-badge">SALE!</div>' : ''}
                <div class="stock-badge">${isOutOfStock ? 'ПРОДАНО' : stock + ' шт.'}</div>
                
                <img src="${imgUrl}" alt="${item.name}" class="item-icon" 
                     onerror="this.src='https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20/blocks/${item.id}.png'"
                     data-name="${item.name}" data-enchants="${item.enchants || ''}">
                
                <div class="item-name">${item.name}</div>
                <div class="item-prices">
                    <span class="diamond-text">${priceDia} Алмазів</span>
                    <span class="ore-text">або ${priceOre} Руди</span>
                </div>
                
                <div class="qty-controls">
                    <button class="mc-button qty-btn" onclick="addToCart('${item.id}', 1, ${stock})" ${isOutOfStock ? 'disabled' : ''}>+1</button>
                    <button class="mc-button qty-btn" onclick="addToCart('${item.id}', 16, ${stock})" ${isOutOfStock ? 'disabled' : ''}>+16</button>
                    <button class="mc-button qty-btn" onclick="addToCart('${item.id}', 64, ${stock})" ${isOutOfStock ? 'disabled' : ''}>+64</button>
                </div>
            </div>
        `;
    }).join('');

    setupTooltips();
}

// Логіка кошика
function addToCart(id, amount, maxStock) {
    const item = inventoryData.find(i => i.id === id);
    if (!item) return;

    if (!cart[id]) {
        cart[id] = { ...item, quantity: 0 };
    }
    
    if (cart[id].quantity + amount > maxStock) {
        cart[id].quantity = maxStock;
    } else {
        cart[id].quantity += amount;
    }
    
    updateCartCount();
}

function updateCartCount() {
    const totalItems = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cart-count').innerText = totalItems;
}

// Tooltip механіка
function setupTooltips() {
    const tooltip = document.getElementById('mc-tooltip');
    document.querySelectorAll('.item-icon').forEach(icon => {
        icon.addEventListener('mousemove', (e) => {
            const name = e.target.dataset.name;
            const enchants = e.target.dataset.enchants;
            
            let html = `<div class="tooltip-title">${name}</div>`;
            if (enchants) {
                const enchList = enchants.split(',');
                enchList.forEach(ench => {
                    html += `<span class="tooltip-enchant">${ench.trim()}</span>`;
                });
            }
            
            tooltip.innerHTML = html;
            tooltip.style.left = (e.pageX + 15) + 'px';
            tooltip.style.top = (e.pageY + 15) + 'px';
            tooltip.classList.remove('hidden');
        });
        
        icon.addEventListener('mouseleave', () => {
            tooltip.classList.add('hidden');
        });
    });
}

// Модалки та Checkout
function setupEventListeners() {
    const cartModal = document.getElementById('cart-modal');
    const successModal = document.getElementById('success-modal');

    document.getElementById('cart-toggle-btn').addEventListener('click', () => {
        renderCartItems();
        cartModal.classList.remove('hidden');
    });

    document.getElementById('close-cart-btn').addEventListener('click', () => {
        cartModal.classList.add('hidden');
    });

    document.getElementById('close-success-btn').addEventListener('click', () => {
        successModal.classList.add('hidden');
    });

    document.getElementById('checkout-btn').addEventListener('click', processCheckout);
}

function renderCartItems() {
    const list = document.getElementById('cart-items');
    const cartArr = Object.values(cart);
    
    if (cartArr.length === 0) {
        list.innerHTML = '<div style="text-align:center; padding: 20px;">Кошик порожній</div>';
        document.getElementById('total-diamonds').innerText = '0 алм.';
        return;
    }

    let totalDiamonds = 0;
    
    list.innerHTML = cartArr.map(item => {
        const itemTotal = item.quantity * item.price_diamonds;
        totalDiamonds += itemTotal;
        return `
            <div class="cart-item-row">
                <span>${item.name} (x${item.quantity})</span>
                <span class="diamond-text">${itemTotal} алм.</span>
                <button class="mc-button qty-btn" onclick="removeFromCart('${item.id}')" style="background:#ff5555;color:#fff;">X</button>
            </div>
        `;
    }).join('');

    const totalOre = Math.floor(totalDiamonds / CONFIG.CURRENCY_RATE);
    const remainder = totalDiamonds % CONFIG.CURRENCY_RATE;
    
    let oreText = `${totalOre} руди`;
    if (remainder > 0) oreText += ` і ${remainder} алм.`;

    document.getElementById('total-diamonds').innerText = `${totalDiamonds} алм.`;
    document.querySelector('.ore-text').innerText = `(~ ${oreText})`;
}

window.removeFromCart = function(id) {
    delete cart[id];
    updateCartCount();
    renderCartItems();
}

async function processCheckout() {
    const cartArr = Object.values(cart);
    if (cartArr.length === 0) return;

    let totalDiamonds = 0;
    let orderText = `Привіт! Хочу купити:\n`;
    
    cartArr.forEach((item, index) => {
        const itemTotal = item.quantity * item.price_diamonds;
        totalDiamonds += itemTotal;
        orderText += `${index + 1}. ${item.name} (x${item.quantity}) — ${itemTotal} алм.\n`;
    });

    const totalOre = Math.floor(totalDiamonds / CONFIG.CURRENCY_RATE);
    orderText += `Разом: ${totalDiamonds} алмазів (або ~${totalOre} руди). Мій нік: [Впиши свій нік]`;

    // Копіювання в буфер
    try {
        await navigator.clipboard.writeText(orderText);
    } catch (err) {
        console.error('Помилка копіювання:', err);
    }

    // Webhook Discord
    if (CONFIG.DISCORD_WEBHOOK_URL) {
        fetch(CONFIG.DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: "Vault Bot",
                content: `🚨 **Нове замовлення формується на сайті!**\n\`\`\`text\n${orderText}\n\`\`\``
            })
        }).catch(console.error);
    }

    document.getElementById('cart-modal').classList.add('hidden');
    document.getElementById('success-modal').classList.remove('hidden');
    cart = {}; // Очищення
    updateCartCount();
}
