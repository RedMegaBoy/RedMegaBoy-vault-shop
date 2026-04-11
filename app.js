let inventoryData = [];
let cart = {};
let currentCategory = 'Усі';

document.addEventListener('DOMContentLoaded', () => {
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
        // Тепер головна ціна береться з price_ore
        const priceOre = parseFloat(item.price_ore) || 0; 
        const priceDia = Math.round(priceOre * CONFIG.CURRENCY_RATE);
        
        // Нова система пакунків (Bundles)
        const bundle = parseInt(item.bundle) || 1;
        const isOutOfStock = stock <= 0;
        
        let bundleText = bundle === 64 ? '1 стак' : `${bundle} шт.`;
        if (bundle === 1) bundleText = '1 шт.';

        const imgItemsUrl = `${CONFIG.ASSETS_ITEMS_URL}${item.id}.png`;
        const imgBlocksUrl = `${CONFIG.ASSETS_BLOCKS_URL}${item.id}.png`;

        return `
            <div class="item-card ${isOutOfStock ? 'out-of-stock' : ''}">
                ${item.is_sale && item.is_sale.toUpperCase() === 'TRUE' ? '<div class="sale-badge">SALE!</div>' : ''}
                <div class="stock-badge">${isOutOfStock ? 'ПРОДАНО' : 'Доступно: ' + stock}</div>
                
                <img src="${imgItemsUrl}" alt="${item.name}" class="item-icon" 
                     onerror="this.onerror=null; this.src='${imgBlocksUrl}'"
                     data-name="${item.name}" data-enchants="${item.enchants || ''}">
                
                <div class="item-name">${item.name}</div>
                <div class="item-prices">
                    <span class="ore-text">${priceOre} Руди <br><span style="color:#aaa; font-size:8px;">за ${bundleText}</span></span>
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
    renderCartItems();
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

    let totalOre = 0;
    
    list.innerHTML = cartArr.map(item => {
        const priceOre = parseFloat(item.price_ore) || 0;
        const bundle = parseInt(item.bundle) || 1;
        const itemTotalOre = Number((item.quantity * priceOre).toFixed(2));
        totalOre += itemTotalOre;
        
        let bundleStr = bundle === 64 ? 'стак' : `${bundle}шт`;
        if (bundle === 1) bundleStr = 'шт';

        return `
            <div class="cart-item-row">
                <div style="width: 140px; word-wrap: break-word;">
                    ${item.name} <span style="color:#aaa; font-size:8px;">[по ${bundleStr}]</span> <br> 
                    <span style="color:#ffaa00">x${item.quantity}</span>
                </div>
                <div style="text-align: right;">
                    <span class="ore-text" style="font-size: 9px; margin:0;">${itemTotalOre} руд.</span>
                </div>
                <button class="mc-button qty-btn" onclick="removeFromCart('${item.id}')" style="background:#ff5555;color:#fff; border-color:#aa0000; width: 24px;">X</button>
            </div>
        `;
    }).join('');

    // Фінальний підрахунок
    totalOre = Number(totalOre.toFixed(2));
    const totalDiamonds = Math.round(totalOre * CONFIG.CURRENCY_RATE);

    document.getElementById('total-ore').innerText = `${totalOre} Руди`;
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

    let totalOre = 0;
    let orderText = `Привіт! Хочу купити:\n`;
    
    cartArr.forEach((item, index) => {
        const priceOre = parseFloat(item.price_ore) || 0;
        const bundle = parseInt(item.bundle) || 1;
        const itemTotalOre = Number((item.quantity * priceOre).toFixed(2));
        totalOre += itemTotalOre;
        
        let bundleStr = bundle === 64 ? 'стак' : `${bundle}шт`;
        if (bundle === 1) bundleStr = 'шт';

        orderText += `${index + 1}. ${item.name} [по ${bundleStr}] (x${item.quantity}) — ${itemTotalOre} руди\n`;
    });

    totalOre = Number(totalOre.toFixed(2));
    const totalDiamonds = Math.round(totalOre * CONFIG.CURRENCY_RATE);

    orderText += `Разом: ${totalOre} руди (або ${totalDiamonds} алмазів). Мій нік: [Впиши свій нік]`;

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
