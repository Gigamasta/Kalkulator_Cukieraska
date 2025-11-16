// Alexander Diabetes Manager - Main Application

// State management using JavaScript objects (no localStorage due to sandbox)
const AppState = {
  products: [],
  categories: ['Piekarnicze', 'Owoce', 'Warzywa', 'Mleko', 'Mięso', 'Słodyczne', 'Napoje', 'Inne'],
  selectedProducts: [],
  bolusHistory: [],
  parameters: {
    targetGlucose: 100,
    icr: 10,
    isf: 50,
    insulinDuration: 240
  },
  currentTab: 'calculator',
  cameraStream: null,
  scanningMode: null
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initializeTabs();
  initializeCalculator();
  initializeProducts();
  initializeScanner();
  initializeGuide();
  loadSampleData();
});

// Tab navigation
function initializeTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));
      
      btn.classList.add('active');
      document.getElementById(tabName).classList.add('active');
      
      AppState.currentTab = tabName;
      
      if (tabName === 'scanner') {
        stopCamera();
      }
    });
  });
}

// CALCULATOR TAB
function initializeCalculator() {
  const calculateBtn = document.getElementById('calculate-bolus');
  const addProductBtn = document.getElementById('add-product-btn');
  const confirmBtn = document.getElementById('confirm-bolus');
  const cancelBtn = document.getElementById('cancel-bolus');
  
  calculateBtn.addEventListener('click', calculateBolus);
  addProductBtn.addEventListener('click', openProductSelectModal);
  confirmBtn.addEventListener('click', confirmAndSaveBolus);
  cancelBtn.addEventListener('click', cancelBolus);
  
  renderSelectedProducts();
  renderBolusHistory();
}

let pendingBolus = null;

function calculateBolus() {
  const glucoseLevel = parseFloat(document.getElementById('glucose-level').value);
  const targetGlucose = parseFloat(document.getElementById('target-glucose').value);
  const icr = parseFloat(document.getElementById('icr').value);
  const isf = parseFloat(document.getElementById('isf').value);
  const manualCarbs = parseFloat(document.getElementById('manual-carbs').value) || 0;
  
  if (!glucoseLevel || glucoseLevel <= 0) {
    alert('Proszę wprowadzić prawidłowy poziom glikemii');
    return;
  }
  
  // Calculate total carbs from selected products
  let totalCarbs = manualCarbs;
  
  AppState.selectedProducts.forEach(item => {
    const product = AppState.products.find(p => p.id === item.productId);
    if (product) {
      const carbsPerUnit = product.carbs / 100;
      totalCarbs += carbsPerUnit * item.quantity;
    }
  });
  
  // Bolus calculations
  const mealBolus = totalCarbs / icr;
  const correctionBolus = (glucoseLevel - targetGlucose) / isf;
  const totalBolus = Math.max(0, mealBolus + correctionBolus);
  
  // Store pending bolus
  pendingBolus = {
    timestamp: new Date(),
    glucose: glucoseLevel,
    carbs: totalCarbs,
    totalBolus: totalBolus,
    mealBolus: mealBolus,
    correctionBolus: correctionBolus
  };
  
  // Display results
  document.getElementById('meal-bolus').textContent = mealBolus.toFixed(2);
  document.getElementById('correction-bolus').textContent = correctionBolus.toFixed(2);
  document.getElementById('total-bolus').textContent = totalBolus.toFixed(2);
  document.getElementById('total-carbs').textContent = totalCarbs.toFixed(1);
  document.getElementById('bolus-result').style.display = 'block';
}

function confirmAndSaveBolus() {
  if (!pendingBolus) return;
  
  // Add to history
  AppState.bolusHistory.unshift(pendingBolus);
  
  if (AppState.bolusHistory.length > 20) {
    AppState.bolusHistory = AppState.bolusHistory.slice(0, 20);
  }
  
  renderBolusHistory();
  
  // Clear pending and hide result
  pendingBolus = null;
  document.getElementById('bolus-result').style.display = 'none';
  
  // Reset form
  document.getElementById('glucose-level').value = '';
  document.getElementById('manual-carbs').value = '';
  AppState.selectedProducts = [];
  renderSelectedProducts();
  
  alert('✓ Bolus zapisany do historii!');
}

function cancelBolus() {
  pendingBolus = null;
  document.getElementById('bolus-result').style.display = 'none';
}

function renderSelectedProducts() {
  const container = document.getElementById('selected-products');
  const summaryContainer = document.getElementById('products-summary');
  
  if (AppState.selectedProducts.length === 0) {
    container.innerHTML = '<p class="empty-state" style="padding: var(--space-16); margin: 0;">Brak wybranych produktów</p>';
    summaryContainer.style.display = 'none';
    return;
  }
  
  let totalCarbs = 0;
  let totalProducts = AppState.selectedProducts.length;
  
  container.innerHTML = AppState.selectedProducts.map((item, index) => {
    const product = AppState.products.find(p => p.id === item.productId);
    if (!product) return '';
    
    const carbsPerUnit = product.carbs / 100;
    const itemCarbs = carbsPerUnit * item.quantity;
    totalCarbs += itemCarbs;
    
    return `
      <div class="selected-product-item">
        <div class="selected-product-name">
          ${product.name} (${itemCarbs.toFixed(1)}g węgl.)
        </div>
        <div class="quantity-controls">
          <button class="quantity-btn" onclick="changeProductQuantity(${index}, -10)">-</button>
          <input type="number" class="quantity-input" value="${item.quantity}" 
                 inputmode="numeric" onchange="updateProductQuantity(${index}, this.value)">
          <span class="unit-small">${product.unit}</span>
          <button class="quantity-btn" onclick="changeProductQuantity(${index}, 10)">+</button>
        </div>
        <button class="remove-product-btn" onclick="removeSelectedProduct(${index})">✕</button>
      </div>
    `;
  }).join('');
  
  // Update summary
  const ww = (totalCarbs / 10).toFixed(1);
  summaryContainer.innerHTML = `Razem: <strong>${totalProducts}</strong> produktów, <strong>${totalCarbs.toFixed(1)}g</strong> węglowodanow (<strong>${ww} WW</strong>)`;
  summaryContainer.style.display = 'block';
}

function changeProductQuantity(index, delta) {
  AppState.selectedProducts[index].quantity = Math.max(0, AppState.selectedProducts[index].quantity + delta);
  renderSelectedProducts();
}

function updateProductQuantity(index, value) {
  AppState.selectedProducts[index].quantity = Math.max(0, parseFloat(value) || 0);
  renderSelectedProducts();
}

function removeSelectedProduct(index) {
  AppState.selectedProducts.splice(index, 1);
  renderSelectedProducts();
}

function renderBolusHistory() {
  const container = document.getElementById('bolus-history');
  
  if (AppState.bolusHistory.length === 0) {
    container.innerHTML = '<p class="empty-state" style="padding: var(--space-16); margin: 0;">Brak historii</p>';
    return;
  }
  
  container.innerHTML = AppState.bolusHistory.map((entry, index) => `
    <div class="history-item">
      <div class="history-item-header">
        <div class="history-time">${formatDate(entry.timestamp)}</div>
        <button class="delete-history-btn" onclick="deleteHistoryEntry(${index})" title="Usuń">🗑️ Usuń</button>
      </div>
      <div class="history-data">
        <div><strong>Glikemia:</strong> ${entry.glucose} mg/dl</div>
        <div><strong>Węglowodany:</strong> ${entry.carbs.toFixed(1)}g</div>
        <div><strong>Bolus posiłkowy:</strong> ${entry.mealBolus.toFixed(2)}j</div>
        <div><strong>Bolus korygujący:</strong> ${entry.correctionBolus.toFixed(2)}j</div>
        <div style="grid-column: 1 / -1;"><strong>Całkowity bolus:</strong> ${entry.totalBolus.toFixed(2)}j</div>
      </div>
    </div>
  `).join('');
}

function deleteHistoryEntry(index) {
  if (confirm('Czy na pewno chcesz usunąć tę pozycję z historii?')) {
    AppState.bolusHistory.splice(index, 1);
    renderBolusHistory();
  }
}

// PRODUCTS TAB
function initializeProducts() {
  const addBtn = document.getElementById('add-new-product');
  const searchInput = document.getElementById('search-products');
  const categoryFilter = document.getElementById('category-filter');
  const sortSelect = document.getElementById('sort-products');
  const addCategoryBtn = document.getElementById('add-category-btn');
  
  addBtn.addEventListener('click', () => openProductForm());
  searchInput.addEventListener('input', renderProducts);
  categoryFilter.addEventListener('change', renderProducts);
  sortSelect.addEventListener('change', renderProducts);
  addCategoryBtn.addEventListener('click', addCategory);
  
  populateCategoryFilter();
  populateCategorySelect();
  renderProducts();
  renderCategories();
}

function renderCategories() {
  const container = document.getElementById('categories-list');
  container.innerHTML = AppState.categories.map(cat => `
    <div class="category-tag">
      <span>${cat}</span>
      <button onclick="deleteCategory('${cat}')" title="Usuń kategorię">×</button>
    </div>
  `).join('');
}

function addCategory() {
  const input = document.getElementById('new-category-input');
  const newCategory = input.value.trim();
  
  if (!newCategory) {
    alert('Wprowadź nazwę kategorii');
    return;
  }
  
  if (AppState.categories.includes(newCategory)) {
    alert('Ta kategoria już istnieje');
    return;
  }
  
  AppState.categories.push(newCategory);
  input.value = '';
  
  renderCategories();
  populateCategoryFilter();
  populateCategorySelect();
}

function deleteCategory(category) {
  const productsUsingCategory = AppState.products.filter(p => p.category === category);
  
  if (productsUsingCategory.length > 0) {
    if (!confirm(`Kategoria "${category}" jest używana przez ${productsUsingCategory.length} produkt(y/ów). Czy na pewno chcesz ją usunąć? Produkty zostaną przeniesione do kategorii "Inne".`)) {
      return;
    }
    
    // Move products to "Inne"
    productsUsingCategory.forEach(product => {
      product.category = 'Inne';
    });
  }
  
  AppState.categories = AppState.categories.filter(c => c !== category);
  
  renderCategories();
  populateCategoryFilter();
  populateCategorySelect();
  renderProducts();
}

function populateCategoryFilter() {
  const select = document.getElementById('category-filter');
  select.innerHTML = '<option value="">Wszystkie kategorie</option>' + 
    AppState.categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
}

function populateCategorySelect() {
  const select = document.getElementById('product-category');
  select.innerHTML = '<option value="">Wybierz kategorię</option>' + 
    AppState.categories.map(cat => `<option value="${cat}">${cat}</option>`).join('');
}

function renderProducts() {
  const searchTerm = document.getElementById('search-products').value.toLowerCase();
  const categoryFilter = document.getElementById('category-filter').value;
  const sortBy = document.getElementById('sort-products').value;
  
  let filtered = AppState.products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm);
    const matchesCategory = !categoryFilter || product.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });
  
  // Sort
  filtered.sort((a, b) => {
    switch(sortBy) {
      case 'date-desc': return b.dateAdded - a.dateAdded;
      case 'date-asc': return a.dateAdded - b.dateAdded;
      case 'name-asc': return a.name.localeCompare(b.name);
      case 'name-desc': return b.name.localeCompare(a.name);
      default: return 0;
    }
  });
  
  const container = document.getElementById('products-list');
  
  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🍎</div><p>Brak produktów</p></div>';
    return;
  }
  
  container.innerHTML = filtered.map(product => `
    <div class="product-card">
      <div class="product-card-header">
        <div class="product-card-title">${product.name}</div>
        <div class="product-card-category">${product.category}</div>
      </div>
      <div class="product-card-info">
        <div class="product-info-item">
          <strong>Węglowodany</strong>
          ${product.carbs}g / 100${product.unit}
        </div>
        ${product.protein ? `
          <div class="product-info-item">
            <strong>Białko</strong>
            ${product.protein}g / 100${product.unit}
          </div>
        ` : ''}
        ${product.fat ? `
          <div class="product-info-item">
            <strong>Tłuszcze</strong>
            ${product.fat}g / 100${product.unit}
          </div>
        ` : ''}
        ${product.calories ? `
          <div class="product-info-item">
            <strong>Kalorie</strong>
            ${product.calories} kcal / 100${product.unit}
          </div>
        ` : ''}
      </div>
      ${product.notes ? `<p style="font-size: var(--font-size-sm); color: var(--color-text-secondary); margin-top: var(--space-8);">${product.notes}</p>` : ''}
      ${product.ean ? `<p style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: var(--space-4);">EAN: ${product.ean}</p>` : ''}
      <div class="product-card-actions">
        <button class="btn btn--secondary btn--small" onclick="editProduct('${product.id}')">✏️ Edytuj</button>
        <button class="btn btn--secondary btn--small" onclick="deleteProduct('${product.id}')">🗑️ Usuń</button>
      </div>
    </div>
  `).join('');
}

function openProductForm(productId = null) {
  const modal = document.getElementById('product-form-modal');
  const form = document.getElementById('product-form');
  const title = document.getElementById('product-form-title');
  
  form.reset();
  
  if (productId) {
    const product = AppState.products.find(p => p.id === productId);
    if (product) {
      title.textContent = 'Edytuj produkt';
      document.getElementById('product-id').value = product.id;
      document.getElementById('product-name').value = product.name;
      document.getElementById('product-ean').value = product.ean || '';
      document.querySelector(`input[name="product-unit"][value="${product.unit}"]`).checked = true;
      document.getElementById('product-carbs').value = product.carbs;
      document.getElementById('product-protein').value = product.protein || '';
      document.getElementById('product-fat').value = product.fat || '';
      document.getElementById('product-calories').value = product.calories || '';
      document.getElementById('product-category').value = product.category;
      document.getElementById('product-notes').value = product.notes || '';
    }
  } else {
    title.textContent = 'Dodaj produkt';
  }
  
  modal.classList.add('active');
}

function editProduct(id) {
  openProductForm(id);
}

function deleteProduct(id) {
  if (confirm('Czy na pewno chcesz usunąć ten produkt?')) {
    AppState.products = AppState.products.filter(p => p.id !== id);
    renderProducts();
  }
}

// Product form submission
document.getElementById('product-form').addEventListener('submit', (e) => {
  e.preventDefault();
  
  const productId = document.getElementById('product-id').value;
  const selectedUnit = document.querySelector('input[name="product-unit"]:checked');
  
  if (!selectedUnit) {
    alert('Wybierz jednostkę');
    return;
  }
  
  const productData = {
    id: productId || generateId(),
    name: document.getElementById('product-name').value,
    ean: document.getElementById('product-ean').value,
    unit: selectedUnit.value,
    carbs: parseFloat(document.getElementById('product-carbs').value),
    protein: parseFloat(document.getElementById('product-protein').value) || null,
    fat: parseFloat(document.getElementById('product-fat').value) || null,
    calories: parseFloat(document.getElementById('product-calories').value) || null,
    category: document.getElementById('product-category').value,
    notes: document.getElementById('product-notes').value,
    dateAdded: productId ? AppState.products.find(p => p.id === productId).dateAdded : new Date()
  };
  
  if (productId) {
    const index = AppState.products.findIndex(p => p.id === productId);
    AppState.products[index] = productData;
  } else {
    AppState.products.push(productData);
  }
  
  document.getElementById('product-form-modal').classList.remove('active');
  renderProducts();
});

// Product selection modal
function openProductSelectModal() {
  const modal = document.getElementById('product-select-modal');
  modal.classList.add('active');
  renderModalProducts();
}

function renderModalProducts(searchTerm = '') {
  const container = document.getElementById('modal-products-list');
  const filtered = AppState.products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (filtered.length === 0) {
    container.innerHTML = '<p class="empty-state">Brak produktów</p>';
    return;
  }
  
  container.innerHTML = filtered.map(product => `
    <div class="product-card" onclick="selectProduct('${product.id}')" style="cursor: pointer;">
      <div class="product-card-header">
        <div class="product-card-title">${product.name}</div>
        <div class="product-card-category">${product.category}</div>
      </div>
      <div class="product-card-info">
        <div class="product-info-item">
          <strong>Węglowodany:</strong> ${product.carbs}g / 100${product.unit}
        </div>
      </div>
    </div>
  `).join('');
}

function selectProduct(productId) {
  AppState.selectedProducts.push({
    productId: productId,
    quantity: 100
  });
  
  document.getElementById('product-select-modal').classList.remove('active');
  renderSelectedProducts();
}

document.getElementById('modal-search').addEventListener('input', (e) => {
  renderModalProducts(e.target.value);
});

// SCANNER TAB
let barcodeDetectionInterval = null;
let html5QrCode = null;

function initializeScanner() {
  document.getElementById('start-barcode-scan').addEventListener('click', () => startScanning('barcode'));
  document.getElementById('start-ocr-scan').addEventListener('click', () => startScanning('ocr'));
  document.getElementById('stop-scan').addEventListener('click', stopCamera);
  document.getElementById('capture-photo').addEventListener('click', captureAndProcessOCR);
  
  // Load html5-qrcode library
  if (!document.getElementById('html5-qrcode-script')) {
    const script = document.createElement('script');
    script.id = 'html5-qrcode-script';
    script.src = 'https://cdn.jsdelivr.net/npm/html5-qrcode/html5-qrcode.min.js';
    document.head.appendChild(script);
  }
  
  // Load Tesseract.js for OCR
  if (!document.getElementById('tesseract-script')) {
    const script = document.createElement('script');
    script.id = 'tesseract-script';
    script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
    document.head.appendChild(script);
  }
}

async function startScanning(mode) {
  AppState.scanningMode = mode;
  
  document.getElementById('scanner-mode-select').style.display = 'none';
  document.getElementById('camera-container').style.display = 'block';
  document.getElementById('scan-result').style.display = 'none';
  
  if (mode === 'barcode') {
    showScannerStatus('scanning', '🔍 Skanowanie w toku...');
    document.getElementById('ocr-capture-container').style.display = 'none';
    await startBarcodeDetection();
  } else if (mode === 'ocr') {
    showScannerStatus('scanning', '📸 Przygotuj aparat do zrobienia zdjęcia etykiety');
    document.getElementById('ocr-capture-container').style.display = 'block';
    await startCamera();
  }
}

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    
    AppState.cameraStream = stream;
    const video = document.getElementById('camera-preview');
    video.srcObject = stream;
  } catch (error) {
    showScannerStatus('error', '✗ Nie można uzyskać dostępu do kamery: ' + error.message);
  }
}

function showScannerStatus(type, message) {
  const statusEl = document.getElementById('scanner-status');
  statusEl.className = 'scanner-status ' + type;
  statusEl.textContent = message;
  statusEl.style.display = 'block';
}

function stopCamera() {
  if (AppState.cameraStream) {
    AppState.cameraStream.getTracks().forEach(track => track.stop());
    AppState.cameraStream = null;
  }
  
  if (html5QrCode) {
    html5QrCode.stop().catch(() => {});
    html5QrCode = null;
  }
  
  if (barcodeDetectionInterval) {
    clearInterval(barcodeDetectionInterval);
    barcodeDetectionInterval = null;
  }
  
  document.getElementById('scanner-mode-select').style.display = 'block';
  document.getElementById('camera-container').style.display = 'none';
  document.getElementById('scanner-status').style.display = 'none';
  document.getElementById('ocr-capture-container').style.display = 'none';
}

async function startBarcodeDetection() {
  if (typeof Html5Qrcode === 'undefined') {
    showScannerStatus('error', '✗ Biblioteka skanera nie została załadowana. Spróbuj ponownie.');
    setTimeout(() => {
      stopCamera();
    }, 3000);
    return;
  }
  
  try {
    html5QrCode = new Html5Qrcode('camera-preview');
    
    await html5QrCode.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39
        ]
      },
      (decodedText) => {
        showScannerStatus('success', '✓ Kod znaleziony: ' + decodedText);
        html5QrCode.stop();
        lookupBarcode(decodedText);
      },
      (errorMessage) => {
        // Scanning in progress - ignore errors
      }
    );
  } catch (error) {
    showScannerStatus('error', '✗ Błąd uruchamiania skanera: ' + error.message);
  }
}

async function captureAndProcessOCR() {
  if (typeof Tesseract === 'undefined') {
    showScannerStatus('error', '✗ Biblioteka OCR nie została załadowana');
    return;
  }
  
  const video = document.getElementById('camera-preview');
  const canvas = document.getElementById('scanner-canvas');
  const ctx = canvas.getContext('2d');
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0);
  
  showScannerStatus('scanning', '🔍 Przetwarzanie obrazu...');
  
  try {
    const result = await Tesseract.recognize(canvas, 'pol+eng', {
      logger: m => console.log(m)
    });
    
    const text = result.data.text;
    console.log('OCR result:', text);
    
    // Try to extract nutritional data
    const carbsMatch = text.match(/węglowodany[:\s]*(\d+[.,]?\d*)/i) || 
                       text.match(/carbohydrat[e]?s?[:\s]*(\d+[.,]?\d*)/i);
    const proteinMatch = text.match(/białko[:\s]*(\d+[.,]?\d*)/i) ||
                         text.match(/protein[:\s]*(\d+[.,]?\d*)/i);
    const fatMatch = text.match(/tłusz[cz]?[e]?[:\s]*(\d+[.,]?\d*)/i) ||
                     text.match(/fat[:\s]*(\d+[.,]?\d*)/i);
    const caloriesMatch = text.match(/kalori[e]?[:\s]*(\d+)/i) ||
                          text.match(/energ[yi][a]?[:\s]*(\d+)/i);
    
    if (carbsMatch) {
      const productData = {
        name: 'Produkt ze skanowania OCR',
        carbs: parseFloat(carbsMatch[1].replace(',', '.')),
        protein: proteinMatch ? parseFloat(proteinMatch[1].replace(',', '.')) : null,
        fat: fatMatch ? parseFloat(fatMatch[1].replace(',', '.')) : null,
        calories: caloriesMatch ? parseInt(caloriesMatch[1]) : null,
        unit: 'g'
      };
      
      showScannerStatus('success', '✓ Znaleziono dane odżywcze!');
      displayScannedProduct(productData);
    } else {
      showScannerStatus('warning', '⚠ Nie znaleziono danych odżywczych. Spróbuj zrobić wyraźniejsze zdjęcie.');
    }
  } catch (error) {
    showScannerStatus('error', '✗ Błąd przetwarzania OCR: ' + error.message);
  }
}

async function lookupBarcode(ean) {
  showScannerStatus('scanning', '🔍 Szukanie produktu w bazie...');
  
  try {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${ean}.json`);
    const data = await response.json();
    
    if (data.status === 1) {
      const product = data.product;
      const unit = product.quantity && product.quantity.toLowerCase().includes('ml') ? 'ml' : 'g';
      
      showScannerStatus('success', '✓ Produkt znaleziony: ' + (product.product_name || 'Nieznany'));
      
      displayScannedProduct({
        name: product.product_name || 'Nieznany produkt',
        ean: ean,
        carbs: parseFloat(product.nutriments?.carbohydrates_100g) || 0,
        protein: parseFloat(product.nutriments?.proteins_100g) || null,
        fat: parseFloat(product.nutriments?.fat_100g) || null,
        calories: parseFloat(product.nutriments?.['energy-kcal_100g']) || null,
        unit: unit
      });
    } else {
      showScannerStatus('warning', '⚠ Kod nie znaleziony w bazie Open Food Facts');
      displayScannedProduct(null);
    }
  } catch (error) {
    showScannerStatus('error', '✗ Błąd podczas wyszukiwania produktu: ' + error.message);
    displayScannedProduct(null);
  }
}

function displayScannedProduct(productData) {
  const container = document.getElementById('scan-result');
  stopCamera();
  
  if (!productData) {
    container.innerHTML = `
      <div class="card">
        <h3>Produkt nie znaleziony</h3>
        <p>Nie znaleziono produktu w bazie. Możesz dodać go ręcznie.</p>
        <button class="btn btn--primary" onclick="openProductForm()">Dodaj ręcznie</button>
        <button class="btn btn--secondary" onclick="location.reload()">Powrót do skanera</button>
      </div>
    `;
  } else {
    const escapedData = JSON.stringify(productData).replace(/'/g, "&#39;");
    container.innerHTML = `
      <div class="card">
        <h3>Znaleziono produkt</h3>
        <div class="product-card-info">
          <div class="product-info-item"><strong>Nazwa:</strong> ${productData.name}</div>
          ${productData.ean ? `<div class="product-info-item"><strong>EAN:</strong> ${productData.ean}</div>` : ''}
          <div class="product-info-item"><strong>Węglowodany:</strong> ${productData.carbs}g/100${productData.unit}</div>
          ${productData.protein ? `<div class="product-info-item"><strong>Białko:</strong> ${productData.protein}g/100${productData.unit}</div>` : ''}
          ${productData.fat ? `<div class="product-info-item"><strong>Tłuszcze:</strong> ${productData.fat}g/100${productData.unit}</div>` : ''}
          ${productData.calories ? `<div class="product-info-item"><strong>Kalorie:</strong> ${productData.calories}kcal/100${productData.unit}</div>` : ''}
        </div>
        <div style="margin-top: var(--space-16); display: flex; gap: var(--space-8); flex-direction: column;">
          <button class="btn btn--primary" onclick='addScannedProduct(${escapedData})'>Dodaj do bazy produktów</button>
          <button class="btn btn--secondary" onclick="location.reload()">Skanuj kolejny produkt</button>
        </div>
      </div>
    `;
  }
  
  container.style.display = 'block';
}

function addScannedProduct(productData) {
  const newProduct = {
    id: generateId(),
    name: productData.name,
    ean: productData.ean || '',
    unit: productData.unit,
    carbs: productData.carbs,
    protein: productData.protein,
    fat: productData.fat,
    calories: productData.calories,
    category: 'Inne',
    notes: 'Dodany ze skanera',
    dateAdded: new Date()
  };
  
  AppState.products.push(newProduct);
  
  alert('✓ Produkt "' + productData.name + '" został dodany do bazy!');
  
  // Return to scanner selection
  document.getElementById('scan-result').style.display = 'none';
  document.getElementById('scanner-mode-select').style.display = 'block';
  document.getElementById('scanner-status').style.display = 'none';
  
  // Refresh products if on products tab
  renderProducts();
}

// GUIDE TAB
function initializeGuide() {
  const guideBtns = document.querySelectorAll('.guide-btn');
  
  guideBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const guideType = btn.dataset.guide;
      displayGuide(guideType);
    });
  });
}

function displayGuide(type) {
  const container = document.getElementById('guide-content');
  const guides = getGuideContent();
  
  if (guides[type]) {
    container.innerHTML = guides[type];
    container.scrollIntoView({ behavior: 'smooth' });
  }
}

function getGuideContent() {
  return {
    'pump-failure': `
      <h3>⚠️ Awaria Pompy Insulinowej</h3>
      
      <div class="alert-box danger">
        <strong>WAŻNE:</strong> Awaria pompy to sytuacja wymagająca natychmiastowego działania. Bez ciągłego podawania insuliny bazowej, dziecko z cukrzycą typu 1 jest narażone na kwasicę ketonową już po 4-6 godzinach.
      </div>
      
      <h4>Krok 1: Rozpoznaj rodzaj awarii</h4>
      <ul>
        <li><strong>Alarm zapchania/zakłócenia:</strong> Sprawdź wkłucie, drenaż i zbiornik z insuliną</li>
        <li><strong>Błąd mechaniczny pompy:</strong> Pompa nie podaje insuliny lub wyświetla błąd krytyczny</li>
        <li><strong>Brak insuliny:</strong> Kończy się insulina w zbiorniku</li>
        <li><strong>Pompa uszkodzona fizycznie:</strong> Pompa uległa uszkodzeniu (zalanie, upadek)</li>
      </ul>
      
      <h4>Krok 2: Natychmiastowe działanie</h4>
      <div class="alert-box warning">
        <p><strong>Jeśli pompa nie działa:</strong></p>
        <ol>
          <li>Zmierz glikemię i ketony (krew lub mocz)</li>
          <li>Przejdź natychmiast na peny insulinowe (długo- i krótkodziałająca)</li>
          <li>Podaj insulinę długodziałającą (np. Tresiba, Levemir) w dawce odpowiadającej 80% całkowitej dawki bazowej z pompy</li>
          <li>Podaj insulinę krótkodziałającą na korekcję, jeśli glikemia >180 mg/dl</li>
          <li>Kontaktuj się z diabetologiem</li>
        </ol>
      </div>
      
      <h4>Krok 3: Obliczenia dawek</h4>
      <p><strong>Dawka bazowa na peny:</strong></p>
      <p>Zsumuj całkowitą dobową dawkę bazową z pompy (sprawdź w ustawieniach pompy). Podaj 80% tej dawki jako insulinę długodziałającą, podzieloną na 1-2 wstrzyknięcia dziennie.</p>
      
      <p><strong>Przykład:</strong> Całkowita dawka bazowa z pompy = 10j/dobę → Podaj 8j insuliny długodziałającej raz dziennie</p>
      
      <p><strong>Dawki posiłkowe:</strong> Zachowaj te same ICR co w pompie, podając insulinę krótkodziałającą penem przed posiłkami.</p>
      
      <h4>Krok 4: Monitorowanie</h4>
      <ul>
        <li>Mierz glikemię co 2-3 godziny</li>
        <li>Sprawdzaj ketony przy glikemii >250 mg/dl</li>
        <li>Podawaj dodatkową insulinę na korekcję według ISF</li>
        <li>Zapewnij odpowiednie nawodnienie</li>
      </ul>
      
      <div class="alert-box info">
        <strong>Przygotowanie awaryjne:</strong> Zawsze miej w domu rezerwowy zestaw penów z insuliną długo- i krótkodziałającą, igły oraz glukagon.
      </div>
    `,
    
    'high-pump': `
      <h3>⬆️ Wysoka Glikemia (Pompa Insulinowa)</h3>
      
      <h4>Poziomy glikemii i działanie:</h4>
      
      <div class="alert-box warning">
        <p><strong>Glikemia 150-250 mg/dl (umiarkowana hiperglikemia):</strong></p>
        <ol>
          <li>Sprawdź, czy nie minęły mniej niż 2 godziny od ostatniego bolusa (aktywna insulina)</li>
          <li>Podaj korekcję według wzoru: (aktualna glikemia - docelowa) / ISF</li>
          <li>Sprawdź wkłucie - czy nie jest zaczerwienione, opuchnięte</li>
          <li>Upewnij się, że pompa działa prawidłowo</li>
          <li>Podawaj wodę (zapobieganie odwodnieniu)</li>
          <li>Zmierz ponownie po 1-2 godzinach</li>
        </ol>
      </div>
      
      <div class="alert-box danger">
        <p><strong>Glikemia >250 mg/dl (poważna hiperglikemia):</strong></p>
        <ol>
          <li><strong>ZAWSZE zmierz ketony</strong> (we krwi lub w moczu)</li>
          <li>Sprawdź drenaż pompy i wkłucie - rozważ wymianę</li>
          <li>Podaj większy bolus korekcyjny (120-150% zwykłej dawki)</li>
          <li>Jeśli ketony wykryte: podaj 10-20% większą dawkę</li>
          <li>Zmień wkłucie i drenaż, jeśli glikemia nie spada po 2 godzinach</li>
          <li>Podawaj wodę regularnie</li>
          <li>Mierz glikemię co godzinę</li>
        </ol>
      </div>
      
      <div class="alert-box danger">
        <p><strong>Glikemia >350 mg/dl lub ketony >1.5 mmol/L:</strong></p>
        <ol>
          <li><strong>NATYCHMIAST</strong> zmień wkłucie i drenaż</li>
          <li>Rozważ podanie insuliny penem (jeśli pompa może nie działać)</li>
          <li>Mierz glikemię i ketony co godzinę</li>
          <li>Podawaj dużo wody</li>
          <li><strong>Kontakt z diabetologiem lub pogotowiem</strong></li>
          <li>Ryzyko kwasicy ketonowej (DKA) - obserwuj objawy: nudności, wymioty, ból brzucha, zapach acetonu z ust</li>
        </ol>
      </div>
      
      <h4>Przyczyny wysokiej glikemii:</h4>
      <ul>
        <li>Zbyt mała dawka insuliny do posiłku</li>
        <li>Zatkany drenaż lub słabe wkłucie</li>
        <li>Choroba, infekcja, gorączka</li>
        <li>Stres</li>
        <li>Insulina przeterminowana lub źle przechowywana</li>
        <li>Niewystarczająca dawka bazowa</li>
      </ul>
    `,
    
    'low-pump': `
      <h3>⬇️ Niska Glikemia (Pompa Insulinowa)</h3>
      
      <div class="alert-box warning">
        <p><strong>Glikemia 70-100 mg/dl (lekka hipoglikemia):</strong></p>
        <ol>
          <li>Obserwuj dziecko - czy są objawy: drżenie, bladość, pocenie się, płaczliwość?</li>
          <li>Jeśli brak objawów: kontynuuj monitorowanie co 15-30 minut</li>
          <li>Jeśli obecne objawy: podaj 5-10g węglowodanów szybkodzia łających (sok, tabletki glukozy)</li>
          <li>Zmierz ponownie po 15 minutach</li>
        </ol>
      </div>
      
      <div class="alert-box danger">
        <p><strong>Glikemia 54-70 mg/dl (umiarkowana hipoglikemia):</strong></p>
        <ol>
          <li><strong>NATYCHMIAST</strong> podaj 10-15g szybkodzia łających węglowodanów</li>
          <li>Przykłady: 100ml soku pomarańczowego, 3-4 tabletki glukozy, łyżeczka miodu</li>
          <li>Zawiś tymczasowo pompę lub zmniejsz bazę o 50% na 30 minut</li>
          <li>Nie podawaj więcej insuliny</li>
          <li>Zmierz glikemię po 15 minutach</li>
          <li>Jeśli nadal <70 mg/dl: powtórz podanie 10-15g węglowodanów</li>
          <li>Po normalizacji (>100 mg/dl) podaj przekąskę z białkiem i tłuszczami</li>
        </ol>
      </div>
      
      <div class="alert-box danger">
        <p><strong>Glikemia <54 mg/dl (ciężka hipoglikemia):</strong></p>
        <ol>
          <li><strong>ZAWIŚ POMPĘ</strong></li>
          <li>Podaj 15-20g szybkodzia łających węglowodanów</li>
          <li>Jeśli dziecko nieprzytomne lub nie może połknąć: <strong>NIE podawaj jedzenia/picia!</strong></li>
          <li>Jeśli nieprzytomne: <strong>Glukagon domięśniowo</strong> (zgodnie z wagą dziecka)</li>
          <li>Połóż dziecko na boku (pozycja bezpieczna)</li>
          <li><strong>ZADZWOŃ PO POGOTOWIE (999/112)</strong></li>
          <li>Po odzyskaniu przytomności: daj sok i przekąskę</li>
        </ol>
      </div>
      
      <h4>Dawkowanie glukagonu dla niemowląt i małych dzieci:</h4>
      <ul>
        <li><strong>Waga <10 kg:</strong> 0.5 mg (połowa ampułki)</li>
        <li><strong>Waga >10 kg:</strong> 1 mg (cała ampułka)</li>
      </ul>
      
      <h4>Objawy hipoglikemii u niemowląt:</h4>
      <ul>
        <li>Drżenie, drgawki</li>
        <li>Nadmierna senność lub trudności z obudzeniem</li>
        <li>Bladość, pocenie się</li>
        <li>Drażliwość, płacz</li>
        <li>Szybkie oddychanie</li>
        <li>Niechęć do ssania/jedzenia</li>
      </ul>
      
      <div class="alert-box info">
        <strong>Zapobieganie hipoglikemii:</strong> Regularnie sprawdzaj glikemię (co 2-3 godziny u niemowląt), szczególnie w nocy. Rozważ użycie systemu CGM (ciągłego monitorowania glikemii) z alarmami.
      </div>
    `,
    
    'high-pens': `
      <h3>⬆️ Wysoka Glikemia (Peny Insulinowe)</h3>
      
      <h4>Obliczanie bolusa korekcyjnego:</h4>
      <p><strong>Wzór:</strong> Bolus korygujący = (aktualna glikemia - glikemia docelowa) / ISF</p>
      <p><strong>Przykład:</strong> Glikemia = 220 mg/dl, docelowa = 100 mg/dl, ISF = 50<br>
Bolus = (220 - 100) / 50 = 2.4j insuliny</p>
      
      <div class="alert-box warning">
        <p><strong>Glikemia 150-250 mg/dl:</strong></p>
        <ol>
          <li>Sprawdź, ile czasu minęło od ostatniego wstrzyknięcia insuliny</li>
          <li>Jeśli minęły <3 godziny: zaczekaj (aktywna insulina)</li>
          <li>Jeśli minęły >3 godziny: podaj bolus korekcyjny</li>
          <li>Podawaj wodę</li>
          <li>Zmierz ponownie po 2 godzinach</li>
        </ol>
      </div>
      
      <div class="alert-box danger">
        <p><strong>Glikemia >250 mg/dl:</strong></p>
        <ol>
          <li><strong>Zmierz ketony</strong> (krew lub mocz)</li>
          <li>Podaj zwiększony bolus korekcyjny (120% normalnej dawki)</li>
          <li>Jeśli ketony obecne: dodaj 10-20% do dawki</li>
          <li>Podawaj dużo wody</li>
          <li>Mierz glikemię co 2 godziny</li>
          <li>Kontakt z diabetologiem, jeśli brak poprawy po 4 godzinach</li>
        </ol>
      </div>
      
      <h4>Kiedy wzywać pomoc:</h4>
      <ul>
        <li>Glikemia >350 mg/dl przez >4 godziny</li>
        <li>Ketony >1.5 mmol/L lub "umiarkowane/wysokie" w moczu</li>
        <li>Wymioty, bóle brzucha, zapach acetonu</li>
        <li>Dziecko letargiczne, osłabione</li>
      </ul>
    `,
    
    'low-pens': `
      <h3>⬇️ Niska Glikemia (Peny Insulinowe)</h3>
      
      <p>Postępowanie przy hipoglikemii jest takie samo jak w przypadku pompy insulinowej, z wyjątkiem tego, że nie można zawiesić podawania insuliny bazowej.</p>
      
      <div class="alert-box danger">
        <p><strong>Glikemia <70 mg/dl:</strong></p>
        <ol>
          <li>Podaj 10-15g szybkodzia łających węglowodanów</li>
          <li>NIE podawaj więcej insuliny</li>
          <li>Zmierz ponownie po 15 minutach</li>
          <li>Jeśli nadal niska: powtórz węglowodany</li>
          <li>Po normalizacji: przekąska z białkiem</li>
        </ol>
      </div>
      
      <div class="alert-box danger">
        <p><strong>Ciężka hipoglikemia (<54 mg/dl lub nieprzytomność):</strong></p>
        <ol>
          <li><strong>Glukagon domięśniowo</strong></li>
          <li>Połóż na boku</li>
          <li>Wzywaj pogotowie</li>
          <li>NIE podawaj jedzenia/picia, jeśli nieprzytomne</li>
        </ol>
      </div>
      
      <h4>Zapobieganie hipoglikemii nocnej:</h4>
      <ul>
        <li>Sprawdź glikemię przed snem - powinna być >120 mg/dl</li>
        <li>Podaj przekąskę przed snem (białko + węglowodany)</li>
        <li>Sprawdź glikemię w nocy (2-3 w nocy) przez pierwsze tygodnie</li>
        <li>Rozważ zmniejszenie dawki insuliny długodziałającej, jeśli częste hipoglikemie nocne</li>
      </ul>
    `,
    
    'illness': `
      <h3>🤒 Postępowanie w Przypadku Infekcji/Choroby</h3>
      
      <div class="alert-box warning">
        <strong>WAŻNE:</strong> Choroba (gorączka, infekcja, przeziębienie) znacząco wpływa na glikemię. U większości dzieci z cukrzycą zapotrzebowanie na insulinę wzrasta o 20-50% podczas choroby.
      </div>
      
      <h4>Zasady postępowania:</h4>
      
      <p><strong>1. Zwiększone monitorowanie</strong></p>
      <ul>
        <li>Mierz glikemię co 2-3 godziny (lub częściej)</li>
        <li>Sprawdzaj ketony przy glikemii >250 mg/dl</li>
        <li>Prowadź dokładny dzienniczek</li>
      </ul>
      
      <p><strong>2. Dostosowanie insuliny</strong></p>
      <ul>
        <li>Zwiększ dawkę bazową o 10-20% (pompa) lub dawkę insuliny długodziałającej (peny)</li>
        <li>Częstsze podawanie bolusów korekcyjnych</li>
        <li>NIE przerywaj podawania insuliny, nawet jeśli dziecko nie je</li>
      </ul>
      
      <p><strong>3. Nawodnienie</strong></p>
      <ul>
        <li>Podawaj regularne płyny (woda, herbata, rosół)</li>
        <li>Unikaj soków słodzonych, chyba że hipoglikemia</li>
        <li>Cel: minimum 50-100ml/kg/dobę</li>
      </ul>
      
      <p><strong>4. Żywienie</strong></p>
      <ul>
        <li>Podawaj lekko strawne posiłki (jeśli dziecko je)</li>
        <li>Małe porcje, częściej</li>
        <li>Jeśli wymioty: podawaj tylko płyny, ale NIE przerywaj insuliny</li>
      </ul>
      
      <div class="alert-box danger">
        <p><strong>Kiedy natychmiast kontaktować się z lekarzem lub wzywać pogotowie:</strong></p>
        <ul>
          <li>Ketony >1.5 mmol/L lub "umiarkowane/wysokie" w moczu</li>
          <li>Wymioty utrzymujące się >4 godziny</li>
          <li>Glikemia >350 mg/dl przez >4 godziny mimo korekcji</li>
          <li>Objawy odwodnienia: suche usta, brak łez, zapadnięte ciemiączko (u niemowląt)</li>
          <li>Dziecko letargiczne, trudno obudzić</li>
          <li>Bóle brzucha, zapach acetonu z ust</li>
          <li>Gorączka >39°C u niemowlęcia</li>
        </ul>
      </div>
      
      <h4>Schemat korekcji podczas choroby:</h4>
      <p><strong>Jeśli glikemia 150-250 mg/dl:</strong> Zwiększ dawkę korekcyjną o 10%</p>
      <p><strong>Jeśli glikemia >250 mg/dl bez ketonów:</strong> Zwiększ dawkę o 20%</p>
      <p><strong>Jeśli glikemia >250 mg/dl z ketonami:</strong> Zwiększ dawkę o 30% i kontakt z lekarzem</p>
    `,
    
    'snacking': `
      <h3>🍪 Podjadanie i Przekąski</h3>
      
      <h4>Zasady przekąsek dla dzieci z cukrzycą:</h4>
      
      <p><strong>Przekąski niewymagające insuliny (<10g węglowodanów):</strong></p>
      <ul>
        <li>Warzywa (ogórek, papryka, marchewka)</li>
        <li>Ser biały, żółty</li>
        <li>Jajko gotowane</li>
        <li>Orzechy (małe ilości, uwaga na ryzyko zadławienia u małych dzieci)</li>
        <li>Awokado</li>
      </ul>
      
      <p><strong>Przekąski wymagające niewielkiej dawki insuliny (10-15g węglowodanów):</strong></p>
      <ul>
        <li>Małe jabłko lub gruszka</li>
        <li>Jogurt naturalny (100ml)</li>
        <li>Kromka chleba pełnoziarnistego z masłem orzechowym</li>
        <li>Garść jagód lub truskawek</li>
      </ul>
      
      <h4>Kiedy podawać przekąski:</h4>
      <ul>
        <li>Minimum 2 godziny po ostatnim bolusie (unikanie nakładania się działania insuliny)</li>
        <li>Jeśli glikemia przed przekąską <100 mg/dl: rozważ przekąskę bez insuliny</li>
        <li>Jeśli glikemia >150 mg/dl: podaj mniejszą przekąskę lub z pełną dawką insuliny</li>
      </ul>
      
      <h4>Przekąski przed aktywnością fizyczną:</h4>
      <p>Jeśli planowana aktywność (zabawa, spacer):</p>
      <ul>
        <li>Sprawdź glikemię przed rozpoczęciem</li>
        <li>Jeśli <120 mg/dl: podaj 10-15g węglowodanów bez insuliny</li>
        <li>Jeśli >150 mg/dl: można rozpocząć aktywność bez przekąski</li>
        <li>Mierz glikemię po aktywności</li>
      </ul>
      
      <h4>Przekąski nocne:</h4>
      <p>Jeśli glikemia przed snem <120 mg/dl:</p>
      <ul>
        <li>Podaj przekąskę z białkiem i tłuszczami (np. mleko + ciasteczko pełnoziarniste)</li>
        <li>Pomaga utrzymać stabilną glikemię w nocy</li>
        <li>NIE podawaj insuliny na przekąskę nocną</li>
      </ul>
    `,
    
    'holidays': `
      <h3>🎄 Święta i Wyjazdy</h3>
      
      <h4>Przygotowania przed wyjazdem:</h4>
      
      <p><strong>Pakowanie (podwójne ilości wszystkiego!):</strong></p>
      <ul>
        <li>Insulina (pompa + peny zapasowe) - przechowywana w termoizolacyjnej torbie</li>
        <li>Zapasowy wkład do pompy, drenaże, zbiorniki</li>
        <li>Glukometr + paski testowe (2x więcej niż potrzeba)</li>
        <li>Paski do pomiaru ketonów</li>
        <li>Glukagon</li>
        <li>Tabletki glukozy, soki</li>
        <li>Baterie zapasowe do pompy/glukometru</li>
        <li>Zaświadczenie lekarskie (w języku kraju docelowego)</li>
        <li>Receptę na insulinę</li>
      </ul>
      
      <h4>Zmiana stref czasowych:</h4>
      
      <p><strong>Podróż na Zachód (dzień się wydłuża):</strong></p>
      <ul>
        <li>Może być potrzebna dodatkowa dawka insuliny bazowej</li>
        <li>Stopniowo dostosowuj harmonogram posiłków i bolusów</li>
        <li>Częstsze sprawdzanie glikemii pierwszego dnia</li>
      </ul>
      
      <p><strong>Podróż na Wschód (dzień się skraca):</strong></p>
      <ul>
        <li>Może być potrzebne zmniejszenie insuliny bazowej</li>
        <li>Pomiń lub zmniejsz jeden posiłek</li>
        <li>Obserwuj ryzyko hipoglikemii</li>
      </ul>
      
      <h4>Święta i uczty:</h4>
      
      <p><strong>Strategia na duże posiłki:</strong></p>
      <ul>
        <li>Staraj się oszacować węglowodany (lepiej trochę za dużo niż za mało)</li>
        <li>Rozważ podanie bolusa w dwóch dawkach: część przed, część po posiłku</li>
        <li>Tłuste posiłki (np. wigilijna ryba w sosie) opóźniają wchłanianie węglowodanów - rozważ bolus przedłużony (pompa)</li>
        <li>Sprawdź glikemię 1-2 godziny po posiłku i skoryguj</li>
        <li>Miej pod ręką szybkodzia łające węglowodany na wypadek hipoglikemii</li>
      </ul>
      
      <h4>Słodycze i desery:</h4>
      <ul>
        <li>Dziecko z cukrzycą MOŻE jeść słodycze - ważne jest odpowiednie przeliczenie i insulina</li>
        <li>1 cukierek ≈ 5-10g węglowodanów</li>
        <li>Czekolada ma więcej tłuszczu = wolniejsze wchłanianie</li>
        <li>Najlepiej podawać słodycze jako część posiłku, nie osobno</li>
      </ul>
      
      <div class="alert-box info">
        <strong>Ważne:</strong> Nie odmawiaj dziecku uczestnictwa w świętowaniu. Cukrzyca wymaga zarządzania, ale nie eliminowania radości z życia. Z odpowiednią wiedzą i przygotowaniem, dziecko może uczestniczyć we wszystkich uroczystościach.
      </div>
    `,
    
    'school': `
      <h3>🎒 Szkoła i Wyjazdy Szkolne</h3>
      
      <h4>Przygotowanie do szkoły/przedszkola:</h4>
      
      <p><strong>Spotkanie z personelem:</strong></p>
      <ul>
        <li>Zorganizuj spotkanie z nauczycielami, pielęgniarką szkolną przed rozpoczęciem</li>
        <li>Przekaż plan postępowania z cukrzycą (na piśmie)</li>
        <li>Przeszkol personel w zakresie rozpoznawania i leczenia hipoglikemii</li>
        <li>Pokaż, jak używać glukagonu (jeśli dziecko ma epikę)</li>
        <li>Ustal, kto będzie odpowiedzialny za pomoc dziecku</li>
      </ul>
      
      <p><strong>Wyposażenie w szkole (pozostaw na miejscu):</strong></p>
      <ul>
        <li>Glukometr + paski</li>
        <li>Tabletki glukozy, soki</li>
        <li>Przekąski długoterminowe (batoniki, ciastka)</li>
        <li>Glukagon (w lodówce szkolnej)</li>
        <li>Numery kontaktowe rodziców i diabetologa</li>
      </ul>
      
      <h4>Plan działania dla nauczycieli:</h4>
      
      <div class="alert-box warning">
        <p><strong>Objawy hipoglikemii - DZIAŁAJ NATYCHMIAST:</strong></p>
        <ul>
          <li>Bladość, pocenie się</li>
          <li>Drżenie rąk</li>
          <li>Zmiana zachowania (drażliwość, płaczliwość, dziwne zachowanie)</li>
          <li>Senność, trudności z koncentracją</li>
        </ul>
        <p><strong>CO ROBIĆ:</strong></p>
        <ol>
          <li>Natychmiast podaj 10-15g szybkich węglowodanów (sok, tabletki glukozy)</li>
          <li>Poinformuj rodziców</li>
          <li>Sprawdź glikemię po 15 minutach</li>
          <li>Jeśli dziecko nieprzytomne: wzywaj pogotowie, NIE podawaj jedzenia, podaj glukagon</li>
        </ol>
      </div>
      
      <h4>Wyjazdy szkolne i wycieczki:</h4>
      
      <p><strong>Lista kontrolna dla rodziców:</strong></p>
      <ul>
        <li>Poinformuj organizatorów o cukrzycy dziecka</li>
        <li>Przekaż dodatkową insulinę, glukometr, glukagon</li>
        <li>Przeszkol opiekuna w podstawowej opiece</li>
        <li>Daj pisemny plan postępowania</li>
        <li>Podaj numery kontaktowe (być dostępnym telefonicznie)</li>
        <li>Przygotuj przekąski i dodatkowe węglowodany</li>
        <li>Rozważ dostosowanie dawek insuliny (więcej aktywności = mniej insuliny)</li>
      </ul>
      
      <h4>WF i zajęcia sportowe:</h4>
      <ul>
        <li>Sprawdź glikemię przed zajęciami</li>
        <li>Jeśli <120 mg/dl: przekąska przed WF</li>
        <li>Dziecko powinno mieć przy sobie szybkie węglowodany podczas zajęć</li>
        <li>Nauczyciel WF musi wiedzieć o cukrzycy i objawach hipoglikemii</li>
        <li>Sprawdź glikemię po zajęciach</li>
        <li>Ryzyko hipoglikemii może utrzymywać się do kilku godzin po wysiłku</li>
      </ul>
      
      <div class="alert-box info">
        <strong>Prawa dziecka z cukrzycą w szkole:</strong>
        <ul>
          <li>Dostęp do pomiaru glikemii i podania insuliny w dowolnym momencie</li>
          <li>Jedzenie przekąsek w klasie (gdy potrzebne)</li>
          <li>Dostęp do toalety bez ograniczeń</li>
          <li>Nieobecności związane z kontrolami diabetologicznymi</li>
          <li>Wsparcie podczas egzaminów (wydłużony czas, jeśli hipoglikemia)</li>
        </ul>
      </div>
    `,
    
    'critical': `
      <h3>🚨 Sytuacje Krytyczne - Kiedy Wzywać Pogotowie</h3>
      
      <div class="alert-box danger">
        <p><strong>NATYCHMIAST DZWOŃ 999 lub 112 w przypadku:</strong></p>
        
        <h4>Ciężka hipoglikemia:</h4>
        <ul>
          <li>Dziecko nieprzytomne lub ma drgawki</li>
          <li>Nie może połykać</li>
          <li>Glikemia <40 mg/dl</li>
          <li>Podano glukagon, ale brak poprawy po 15 minutach</li>
        </ul>
        
        <h4>Kwasica ketonowa (DKA):</h4>
        <ul>
          <li>Ketony >3 mmol/L lub "wysokie" w moczu</li>
          <li>Wymioty utrzymujące się >4 godziny</li>
          <li>Bóle brzucha, sztywność brzucha</li>
          <li>Zapach acetonu (podobny do zgniłych jabłek) z ust</li>
          <li>Głębokie, szybkie oddychanie (oddech Kussmaula)</li>
          <li>Dezorientacja, letarg, trudności z obudzeniem</li>
          <li>Odwodnienie: suche usta, brak łez, zapadnięte ciemiączko</li>
        </ul>
        
        <h4>Inne sytuacje wymagające natychmiastowej pomocy:</h4>
        <ul>
          <li>Glikemia >500 mg/dl</li>
          <li>Silne odwodnienie</li>
          <li>Gorączka >40°C</li>
          <li>Problemy z oddychaniem</li>
          <li>Utrata przytomności z jakiegokolwiek powodu</li>
        </ul>
      </div>
      
      <h4>CO ROBIĆ podczas oczekiwania na pogotowie:</h4>
      
      <p><strong>Przy hipoglikemii z nieprzytomno ścią:</strong></p>
      <ol>
        <li>NIE podawaj jedzenia ani picia (ryzyko zadławienia)</li>
        <li>Połóż dziecko na boku (pozycja bezpieczna)</li>
        <li>Podaj glukagon domięśniowo:
          <ul>
            <li>Dzieci <10kg: 0.5mg (połowa ampułki)</li>
            <li>Dzieci >10kg: 1mg (cała ampułka)</li>
          </ul>
        </li>
        <li>Obserwuj oddychanie</li>
        <li>Po odzyskaniu przytomności: podaj sok lub glukozę</li>
      </ol>
      
      <p><strong>Przy podejrzeniu DKA:</strong></p>
      <ol>
        <li>Kontynuuj podawanie insuliny (nie przerywaj!)</li>
        <li>Podawaj wodę małymi łykami (jeśli może pić)</li>
        <li>NIE podawaj jedzenia</li>
        <li>Monitoruj glikemię i ketony</li>
        <li>Połóż dziecko na boku, jeśli wymioty</li>
        <li>Przygotuj informacje dla ratowników: ostatnie dawki insuliny, glikemia, ketony</li>
      </ol>
      
      <h4>Numery alarmowe:</h4>
      <ul>
        <li><strong>Pogotowie: 999 lub 112</strong></li>
        <li>Diabetolog (numer twojego lekarza)</li>
        <li>Izba przyjęć dziecięca najbliższego szpitala</li>
      </ul>
      
      <div class="alert-box info">
        <strong>Przygotowanie awaryjne:</strong>
        <ul>
          <li>Miej zawsze aktualny glukagon w lodówce</li>
          <li>Przeszkol wszystkich opiekunów dziecka w podawaniu glukagonu</li>
          <li>Noś przy sobie kartę informacyjną o cukrzycy dziecka</li>
          <li>Zapisz numery alarmowe w szybkim wyborze telefonu</li>
          <li>Przygotuj "torbę awaryjną" z insuliną, glukagonem, glukometrem</li>
        </ul>
      </div>
    `,
    
    'practices': `
      <h3>✅ Dobre Praktyki i Podstawowe Zasady</h3>
      
      <h4>Codzienna opieka nad dzieckiem z cukrzycą typu 1:</h4>
      
      <p><strong>1. Monitorowanie glikemii</strong></p>
      <ul>
        <li><strong>Minimum 4-6 razy dziennie:</strong> przed posiłkami, przed snem, w nocy (2-3)</li>
        <li><strong>Częściej podczas:</strong> choroby, aktywności fizycznej, zmian w terapii</li>
        <li><strong>Docelowe wartości:</strong>
          <ul>
            <li>Niemowlęta/małe dzieci: 100-200 mg/dl (wyższe cele = bezpieczeństwo)</li>
            <li>Dzieci starsze: 80-180 mg/dl</li>
            <li>Przed snem: 120-200 mg/dl (bezpieczeństwo nocne)</li>
          </ul>
        </li>
        <li><strong>Rozważ CGM:</strong> System ciągłego monitorowania glikemii z alarmami - szczególnie przydatny u niemowląt</li>
      </ul>
      
      <p><strong>2. Dzienniczek cukrzycowy</strong></p>
      <ul>
        <li>Zapisuj wszystkie pomiary glikemii</li>
        <li>Dawki insuliny (bazowa i bolusy)</li>
        <li>Węglowodany w posiłkach</li>
        <li>Aktywność fizyczna</li>
        <li>Choroby, stres, nietypowe sytuacje</li>
        <li>Hipoglikemie i ich przyczyny</li>
      </ul>
      
      <p><strong>3. Żywienie</strong></p>
      <ul>
        <li>Regularne posiłki i przekąski (5-6 razy dziennie u niemowląt)</li>
        <li>Zrównoważona dieta: węglowodany, białko, tłuszcze, błonnik</li>
        <li>Przeliczanie węglowodanów (WW) - podstawa terapii</li>
        <li>Unikaj nadmiernie przetworzonej żywności</li>
        <li>Słodycze dozwolone - ważne jest przeliczenie i insulina</li>
      </ul>
      
      <p><strong>4. Wsparcie emocjonalne</strong></p>
      <ul>
        <li>Cukrzyca to wyzwanie dla całej rodziny</li>
        <li>Poszukaj grupy wsparcia dla rodziców</li>
        <li>Edukuj rodzeństwo - niech rozumieją sytuację</li>
        <li>W miarę dorastania, stopniowo wprowadzaj dziecko w samodzielne zarządzanie</li>
        <li>Pamiętaj o własnym zdrowiu psychicznym - wypalenie opiekuna to realne ryzyko</li>
        <li>Korzystaj z pomocy psychologa, jeśli potrzebne</li>
      </ul>
      
      <p><strong>5. Regularne kontrole medyczne</strong></p>
      <ul>
        <li><strong>Diabetolog:</strong> co 3-6 miesięcy (u niemowląt częściej)</li>
        <li><strong>HbA1c:</strong> co 3 miesiące (cel <7.5% u małych dzieci)</li>
        <li><strong>Badania powikłań:</strong> po 5 latach trwania cukrzycy (oczy, nerki)</li>
        <li><strong>Inne badania:</strong> morfologia, TSH, celiakia (częstsze u dzieci z T1D)</li>
      </ul>
      
      <h4>Bezpieczeństwo w domu:</h4>
      <ul>
        <li>Przechowuj insulinę w lodówce (2-8°C), otwartą można trzymać w temp. pokojowej do 28 dni</li>
        <li>Nigdy nie zamrażaj insuliny</li>
        <li>Sprawdzaj daty ważności</li>
        <li>Igły do wstrzykiwaczy używaj tylko raz (ryzyko infekcji i bólu)</li>
        <li>Trzymaj glukagon w lodówce i sprawdzaj ważność</li>
        <li>Miej zawsze zapas sprzętu (paski, igły, insulina)</li>
      </ul>
      
      <h4>Edukacja dziecka (dostosowana do wieku):</h4>
      <ul>
        <li><strong>Niemowlęta/małe dzieci:</strong> Rodzice zarządzają wszystkim</li>
        <li><strong>Przedszkole:</strong> Ucz rozpoznawania "dziwnego samopoczucia" (hipoglikemia)</li>
        <li><strong>Szkoła podstawowa:</strong> Stopniowo ucz przeliczania, samokontroli</li>
        <li><strong>Nastolatki:</strong> Samodzielne zarządzanie pod nadzorem</li>
      </ul>
      
      <div class="alert-box success">
        <h4>Najważniejsze:</h4>
        <ul>
          <li>Cukrzyca typu 1 NIE powstała przez twoje winy jako rodzica</li>
          <li>Z odpowiednim leczeniem, dziecko może żyć pełnią życia</li>
          <li>Nie bądź perfekcjonistą - czasem glikemia będzie poza celem i to normalne</li>
          <li>Cel: bezpieczeństwo i jakość życia, a nie idealne liczby</li>
          <li>Miej ze sobą cały zespół medyczny - diabetolog, pielęgniarka, dietetyk, psycholog</li>
          <li>Bądź dla siebie wyrozumiały - robisz co możesz i to wystarcza</li>
        </ul>
      </div>
    `,
    
    'calculations': `
      <h3>🔢 Obliczanie ICR i ISF - Kalkulator Parametrów</h3>
      
      <h4>Czym są te parametry?</h4>
      
      <p><strong>ICR (Insulin to Carbohydrate Ratio):</strong></p>
      <p>Współczynnik insulina-węglowodany określa, ile gramów węglowodanów kompensuje 1 jednostka insuliny.</p>
      <p><em>Przykład:</em> ICR = 10 oznacza, że 1j insuliny pokrywa 10g węglowodanów</p>
      
      <p><strong>ISF (Insulin Sensitivity Factor):</strong></p>
      <p>Współczynnik wrażliwości na insulinę określa, o ile mg/dl spada glikemia po podaniu 1 jednostki insuliny.</p>
      <p><em>Przykład:</em> ISF = 50 oznacza, że 1j insuliny obniża glikemię o 50 mg/dl</p>
      
      <h4>Reguła 500 (ICR):</h4>
      <p><strong>ICR = 500 / całkowita dzienna dawka insuliny</strong></p>
      
      <p><em>Przykład:</em></p>
      <ul>
        <li>Dziecko otrzymuje 20j insuliny dziennie (bazowa + bolusy)</li>
        <li>ICR = 500 / 20 = 25</li>
        <li>Oznacza to: 1j insuliny na 25g węglowodanów</li>
      </ul>
      
      <h4>Reguła 1800 (ISF):</h4>
      <p><strong>ISF = 1800 / całkowita dzienna dawka insuliny</strong></p>
      
      <p><em>Przykład:</em></p>
      <ul>
        <li>Dziecko otrzymuje 20j insuliny dziennie</li>
        <li>ISF = 1800 / 20 = 90</li>
        <li>Oznacza to: 1j insuliny obniża glikemię o 90 mg/dl</li>
      </ul>
      
      <div class="card" style="margin-top: var(--space-24);">
        <h4>Kalkulator ICR i ISF</h4>
        <div class="form-group">
          <label>Całkowita dzienna dawka insuliny (jednostki):</label>
          <input type="number" id="calc-total-insulin" inputmode="decimal" step="0.1" class="form-control" placeholder="np. 20">
        </div>
        <button class="btn btn--primary" onclick="calculateICRISF()">Oblicz</button>
        <div id="icr-isf-result" style="display:none; margin-top: var(--space-16);">
          <div class="result-card">
            <h4>Wyniki:</h4>
            <div class="result-row">
              <span>ICR (Insulin to Carb Ratio):</span>
              <span>1j na <strong id="icr-result">0</strong>g węglowodanów</span>
            </div>
            <div class="result-row">
              <span>ISF (Insulin Sensitivity Factor):</span>
              <span>1j = <strong id="isf-result">0</strong> mg/dl spadku</span>
            </div>
          </div>
        </div>
      </div>
      
      <h4 style="margin-top: var(--space-24);">Dostosowanie ICR i ISF:</h4>
      
      <div class="alert-box warning">
        <p><strong>Ważne:</strong> Wzory 500 i 1800 to punkty startowe. Rzeczywiste wartości mogą się różnić i należy je dostosowywać na podstawie obserwacji.</p>
      </div>
      
      <p><strong>Kiedy zmniejszyć ICR (więcej insuliny):</strong></p>
      <ul>
        <li>Glikemia regularnie >180 mg/dl po posiłkach</li>
        <li>Wzrost HbA1c</li>
        <li>Przykład: ICR 20 → zmień na ICR 15 (1j na 15g zamiast 20g)</li>
      </ul>
      
      <p><strong>Kiedy zwiększyć ICR (mniej insuliny):</strong></p>
      <ul>
        <li>Częste hipoglikemie po posiłkach</li>
        <li>Glikemia regularnie <80 mg/dl 2-3h po jedzeniu</li>
        <li>Przykład: ICR 15 → zmień na ICR 20</li>
      </ul>
      
      <p><strong>Dostosowywanie ISF:</strong></p>
      <ul>
        <li>Jeśli korekcje nie działają wystarczająco (glikemia spada za mało): zmniejsz ISF</li>
        <li>Jeśli korekcje powodują hipoglikemię: zwiększ ISF</li>
        <li>Przykład: ISF 50 → jeśli za słabe działanie, zmień na ISF 40</li>
      </ul>
      
      <h4>Różne wartości w ciągu dnia:</h4>
      <p>ICR i ISF mogą być różne w różnych porach dnia (zjawisko świtu, aktywność):</p>
      <ul>
        <li><strong>Rano:</strong> Często potrzeba więcej insuliny (niższe ICR, niższe ISF)</li>
        <li><strong>Południe:</strong> Wyższa wrażliwość</li>
        <li><strong>Wieczór:</strong> Umiarkowana wrażliwość</li>
      </ul>
      
      <div class="alert-box info">
        <strong>Konsultuj zmiany z diabetologiem:</strong> Wszelkie większe zmiany w parametrach powinny być konsultowane z lekarzem prowadzącym, szczególnie u małych dzieci.
      </div>
    `
  };
}

// ICR/ISF Calculator function
function calculateICRISF() {
  const totalInsulin = parseFloat(document.getElementById('calc-total-insulin').value);
  
  if (!totalInsulin || totalInsulin <= 0) {
    alert('Proszę wprowadzić prawidłową całkowitą dawkę insuliny');
    return;
  }
  
  const icr = (500 / totalInsulin).toFixed(1);
  const isf = (1800 / totalInsulin).toFixed(0);
  
  document.getElementById('icr-result').textContent = icr;
  document.getElementById('isf-result').textContent = isf;
  document.getElementById('icr-isf-result').style.display = 'block';
}

// UTILITIES
function generateId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

// Modal handlers
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.modal').forEach(modal => {
      modal.classList.remove('active');
    });
  });
});

document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('active');
    }
  });
});

// Load sample data
function loadSampleData() {
  // Sample products
  AppState.products = [
    {
      id: generateId(),
      name: 'Chleb pszenny',
      unit: 'g',
      carbs: 50,
      protein: 8,
      fat: 1,
      calories: 250,
      category: 'Piekarnicze',
      dateAdded: new Date()
    },
    {
      id: generateId(),
      name: 'Jabłko',
      unit: 'g',
      carbs: 14,
      protein: 0.3,
      fat: 0.2,
      calories: 52,
      category: 'Owoce',
      dateAdded: new Date()
    },
    {
      id: generateId(),
      name: 'Mleko 2%',
      unit: 'ml',
      carbs: 4.8,
      protein: 3.2,
      fat: 2,
      calories: 50,
      category: 'Mleko',
      dateAdded: new Date()
    },
    {
      id: generateId(),
      name: 'Jogurt naturalny',
      unit: 'g',
      carbs: 4.5,
      protein: 3.5,
      fat: 3,
      calories: 60,
      category: 'Mleko',
      dateAdded: new Date()
    },
    {
      id: generateId(),
      name: 'Makaron pszenny',
      unit: 'g',
      carbs: 75,
      protein: 12,
      fat: 1.5,
      calories: 350,
      category: 'Piekarnicze',
      notes: 'Waga suchego makaronu',
      dateAdded: new Date()
    }
  ];
  
  renderProducts();
}