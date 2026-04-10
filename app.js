let inventoryData = [];
let cart = {};
let currentCategory = 'Усі';

document.addEventListener('DOMContentLoaded', () => {
    // Нове стабільне посилання на аватарку
    document.getElementById('player-avatar').src = `${CONFIG.AVATAR_API}${CONFIG.USERNAME}/48`;
    loadData();
    setupEventListeners();
});

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
        error: function() {
            document.getElementById('items-grid').innerHTML = '<div class="loading" style="color:#ff5555">Помилка завантаження складу.</div>';
        }
    });
}

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

function renderItems(items) {
    const grid = document.getElementById('items-grid');
    if (items.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align:center;">Нічого не знайдено</div>';
        return;
    }

    grid.innerHTML = items.map(item => {
        const stock = parseInt(item.stock) || 0;
        const priceDia = parseInt(item.price_diamonds) || 0;
        // Рахуємо руду (якщо не ділиться рівно, буде з крапкою, наприклад 1.33)
        const priceOre = Number((priceDia / CONFIG.CURRENCY_RATE).toFixed(2));
        const isOutOfStock = stock <= 0;
        
        // Генерація посилань на іконки
        const imgItemsUrl = `${CONFIG.ASSETS_ITEMS_URL}${item.id}.png`;
        const imgBlocksUrl = `${CONFIG.ASSETS_BLOCKS_URL}${item.id}.png`;

        return `
            <div class="item-card ${isOutOfStock ? 'out-of-stock' : ''}">
                ${item.is_sale && item.is_sale.toUpperCase() === 'TRUE' ? '<div class="sale-badge">SALE!</div>' : ''}
                <div class="stock-badge">${isOutOfStock ? 'ПРОДАНО' : stock + ' шт.'}</div>
                
                <img src="${imgItemsUrl}" alt="${item.name}" class="item-icon" 
                     onerror="this.onerror=null; this.src='${imgBlocksUrl}'"
                     data-name="${item.name}" data-enchants="${item.enchants || ''}">
                
                <div class="item-name">${item.name}</div>
                <div class="item-prices">
                    <span class="ore-text">${priceOre} Руди</span>
                    <span class="diamond-text">(${priceDia} алм.)</span>
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
    renderCartItems(); // ОСЬ ЦЕ ВИПРАВИЛО БАГ: тепер кошик оновлюється відразу!
}

function updateCartCount() {
    const totalItems = Object.values(cart).reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('cart-count').innerText = totalItems;
}

function renderCartItems() {
    const list = document.getElementById('cart-items');
    const cartArr = Object.values(cart);
    
    if (cartArr.length === 0) {
        list.innerHTML = '<div class="empty-cart">Кошик порожній</div>';
        document.getElementById('total-ore').innerText = '0 Руди';
        document.getElementById('total-diamonds').innerText = '(0 алм.)';
        return;
    }

    let totalDiamonds = 0;
    
    list.innerHTML = cartArr.map(item => {
        const itemTotalDiamonds = item.quantity * item.price_diamonds;
        const itemTotalOre = Number((itemTotalDiamonds / CONFIG.CURRENCY_RATE).toFixed(2));
        totalDiamonds += itemTotalDiamonds;
        return `
            <div class="cart-item-row">
                <div style="width: 140px; word-wrap: break-word;">${item.name} <br> <span style="color:#ffaa00">x${item.quantity}</span></div>
                <div style="text-align: right;">
                    <span class="ore-text" style="font-size: 9px; margin:0;">${itemTotalOre} руд.</span>
                </div>
                <button class="mc-button qty-btn" onclick="removeFromCart('${item.id}')" style="background:#ff5555;color:#fff; border-color:#aa0000; width: 24px;">X</button>
            </div>
        `;
    }).join('');

    const totalOre = Math.floor(totalDiamonds / CONFIG.CURRENCY_RATE);
    const remainder = totalDiamonds % CONFIG.CURRENCY_RATE;
    
    let oreText = `${totalOre} Руди`;
    if (remainder > 0) oreText += ` і ${remainder} алм.`;

    document.getElementById('total-ore').innerText = oreText;
    document.getElementById('total-diamonds').innerText = `(Разом: ${totalDiamonds} алм.)`;
}

window.removeFromCart = function(id) {
    delete cart[id];
    updateCartCount();
    renderCartItems();
}

function setupTooltips() {
    const tooltip = document.getElementById('mc-tooltip');
    document.querySelectorAll('.item-icon').forEach(icon => {
        icon.addEventListener('mousemove', (e) => {
            const name = e.target.dataset.name;
            const enchants = e.target.dataset.enchants;
            
            let html = `<div class="tooltip-title">${name}</div>`;
            if (enchants && enchants.trim() !== "") {
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

function setupEventListeners() {
    const successModal = document.getElementById('success-modal');

    document.getElementById('close-success-btn').addEventListener('click', () => {
        successModal.classList.add('hidden');
    });

    document.getElementById('checkout-btn').addEventListener('click', processCheckout);
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
    const remainder = totalDiamonds % CONFIG.CURRENCY_RATE;
    let oreText = `${totalOre} руди`;
    if (remainder > 0) oreText += ` і ${remainder} алм.`;

    orderText += `Разом: ${oreText}. Мій нік: [Впиши свій нік]`;

    try {
        await navigator.clipboard.writeText(orderText);
    } catch (err) {
        console.error('Помилка копіювання:', err);
    }

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

    document.getElementById('success-modal').classList.remove('hidden');
    cart = {}; 
    updateCartCount();
    renderCartItems();
}
