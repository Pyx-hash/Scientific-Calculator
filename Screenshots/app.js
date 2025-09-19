document.addEventListener('DOMContentLoaded', function() {
    // ==============================
    // Constants and State Management
    // ==============================
    const state = {
        // Calculator state
        currentInput: '0',
        expression: '',
        previousAnswer: 0,
        memory: 0,
        history: [],
        isRadians: false,

        // Currency converter state
        exchangeRates: {
            USD: 1,
            EUR: 0.927727,
            GBP: 0.792508,
            JPY: 151.631251,
            AUD: 1.520424,
            CAD: 1.362401,
            CNY: 7.234306,
            PHP: 56.591186
        },
        lastRateUpdate: null,
        manualRate: null,

        // UI state
        soundEnabled: true,
        is3DMode: false,
        isDarkTheme: true
    };

    // DOM Elements
    const elements = {
        // Calculator elements
        result: document.getElementById('result'),
        expression: document.getElementById('expression'),
        historyItems: document.getElementById('history-items'),

        // Currency elements
        amount: document.getElementById('amount'),
        fromCurrency: document.getElementById('from-currency'),
        toCurrency: document.getElementById('to-currency'),
        exchangeRate: document.getElementById('exchange-rate'),
        conversionResult: document.getElementById('conversion-result'),
        rateInfo: document.getElementById('rate-info'),

        // Control buttons
        themeToggle: document.getElementById('theme-toggle'),
        soundToggle: document.getElementById('sound-toggle'),
        mode3DToggle: document.getElementById('3d-toggle'),
        useCalcValue: document.getElementById('use-calc-value'),
        updateRates: document.getElementById('update-rates'),
        swapCurrencies: document.getElementById('swap-currencies'),

        // 3D elements
        calculator3d: document.getElementById('calculator-3d'),

        // Help panel
        helpToggle: document.getElementById('help-toggle'),
        helpContent: document.getElementById('help-content')
    };

    // ==============================
    // Utility Functions
    // ==============================

    // Safe expression evaluation using a simple parser (avoiding eval)
    function safeEval(expression) {
        // Allow digits, operators, parentheses, decimal point, π, e, percent, factorial, letters (for function names), commas
        const sanitized = expression.replace(/[^0-9+\-*/.()πe√^!%a-zA-Z,]/g, '');

        try {
            const isRad = !!state.isRadians;

            // Start processing: replace constants and shorthand
            let processed = sanitized
                .replace(/π/g, 'Math.PI')
                .replace(/\be\b/g, 'Math.E');

            // Replace square root symbol: √9 or √(9+1)
            processed = processed.replace(/√\(?([^\)]+)\)?/g, 'Math.sqrt($1)');

            // Replace factorial like 5! -> fact(5)
            processed = processed.replace(/(\d+)!/g, 'fact($1)');

            // Replace power ^ with **
            processed = processed.replace(/\^/g, '**');

            // Replace log (base10) and ln
            processed = processed.replace(/\blog\(([^)]+)\)/g, 'Math.log10($1)');
            processed = processed.replace(/\bln\(([^)]+)\)/g, 'Math.log($1)');

            // Trig functions - convert degrees to radians if isRad is false
            const degWrap = (fnName) => {
                if (isRad) {
                    return new RegExp('\\b' + fnName + '\\(([^)]+)\\)', 'g');
                } else {
                    // if degrees, convert inside the call
                    return new RegExp('\\b' + fnName + '\\(([^)]+)\\)', 'g');
                }
            };

            if (isRad) {
                processed = processed
                    .replace(degWrap('sin'), 'Math.sin($1)')
                    .replace(degWrap('cos'), 'Math.cos($1)')
                    .replace(degWrap('tan'), 'Math.tan($1)')
                    .replace(degWrap('asin'), 'Math.asin($1)')
                    .replace(degWrap('acos'), 'Math.acos($1)')
                    .replace(degWrap('atan'), 'Math.atan($1)');
            } else {
                processed = processed
                    .replace(degWrap('sin'), 'Math.sin(($1) * Math.PI / 180)')
                    .replace(degWrap('cos'), 'Math.cos(($1) * Math.PI / 180)')
                    .replace(degWrap('tan'), 'Math.tan(($1) * Math.PI / 180)')
                    .replace(degWrap('asin'), '(Math.asin($1) * 180 / Math.PI)')
                    .replace(degWrap('acos'), '(Math.acos($1) * 180 / Math.PI)')
                    .replace(degWrap('atan'), '(Math.atan($1) * 180 / Math.PI)');
            }

            // Percent handling: "50%" -> "(50/100)"
            processed = processed.replace(/(\d+(\.\d+)?)%/g, '($1/100)');

            // Build a safe function with a factorial helper
            const fnBody = `
                const fact = function(n) {
                    n = Number(n);
                    if (!Number.isInteger(n) || n < 0) throw new Error('Invalid factorial');
                    if (n > 170) throw new Error('Factorial too large');
                    let r = 1;
                    for (let i = 2; i <= n; i++) r *= i;
                    return r;
                };
                return (${processed});
            `;

            const fn = new Function(fnBody);
            const result = fn();

            if (typeof result === 'number' && !isFinite(result)) {
                throw new Error('Math result not finite');
            }

            return result;
        } catch (error) {
            // Re-throw to be handled by caller
            throw new Error('Invalid expression');
        }
    }

    // Play button click sound
    function playClickSound() {
        if (!state.soundEnabled) return;

        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.type = 'sine';
            oscillator.frequency.value = 800;
            gainNode.gain.value = 0.1;

            oscillator.start();
            gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.1);

            setTimeout(() => {
                try { oscillator.stop(); } catch (e) {}
            }, 100);
        } catch (error) {
            console.log("Audio context not supported");
        }
    }

    // Format number with commas and appropriate decimal places
    function formatNumber(num) {
        if (typeof num !== 'number' || isNaN(num)) return 'Error';

        if (Math.abs(num) > 1e9) return num.toExponential(4);
        if (Math.abs(num) < 1e-6 && num !== 0) return num.toExponential(6);

        const rounded = Math.round(num * 1e10) / 1e10;

        // Use toLocaleString for better formatting (ensures thousands separators)
        try {
            return rounded.toLocaleString(undefined, { maximumFractionDigits: 10 });
        } catch (e) {
            return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }
    }

    // Add calculation to history
    function addToHistory(expression, result) {
        // store numeric result if possible
        const numericResult = (typeof result === 'number' && !isNaN(result)) ? result : result;
        state.history.unshift({ expression, result: numericResult });
        if (state.history.length > 10) state.history.pop();
        updateHistoryDisplay();
    }

    // Update history display
    function updateHistoryDisplay() {
        if (!elements.historyItems) return;
        elements.historyItems.innerHTML = state.history
            .map(item => `<div class="history-item">${item.expression} = ${typeof item.result === 'number' ? formatNumber(item.result) : item.result}</div>`)
            .join('');
    }

    // Update the calculator display
    function updateDisplay() {
        if (elements.result) {
            const num = parseFloat(state.currentInput);
            elements.result.textContent = (typeof num === 'number' && !isNaN(num)) ? formatNumber(num) : state.currentInput;
        }
        if (elements.expression) {
            elements.expression.textContent = state.expression;
        }
    }

    // Handle calculator input
    function handleInput(value) {
        playClickSound();

        switch (value) {
            case 'AC':
                state.currentInput = '0';
                state.expression = '';
                break;

            case 'C':
                state.currentInput = '0';
                break;

            case '⌫':
                if (state.currentInput.length > 1) {
                    state.currentInput = state.currentInput.slice(0, -1);
                } else {
                    state.currentInput = '0';
                }
                // Also remove last char from expression if possible
                if (state.expression.length > 0) {
                    state.expression = state.expression.slice(0, -1);
                }
                break;

            case '=':
                try {
                    if (state.expression) {
                        const result = safeEval(state.expression);
                        addToHistory(state.expression, result);
                        state.previousAnswer = result;
                        state.currentInput = (typeof result === 'number') ? result.toString() : String(result);
                        state.expression = '';
                    }
                } catch (error) {
                    state.currentInput = 'Error';
                    updateDisplay();
                    setTimeout(() => {
                        state.currentInput = '0';
                        updateDisplay();
                    }, 1000);
                }
                break;

            case 'Ans':
                state.expression += String(state.previousAnswer);
                state.currentInput = String(state.previousAnswer);
                break;

            case 'MC':
                state.memory = 0;
                break;

            case 'MR':
                state.expression += String(state.memory);
                state.currentInput = String(state.memory);
                break;

            case 'M+':
                state.memory += parseFloat(state.currentInput || '0');
                break;

            case 'M-':
                state.memory -= parseFloat(state.currentInput || '0');
                break;

            default:
                // Handle function buttons and constants
                if (['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'log', 'ln', '√', 'π', 'e'].includes(value)) {
                    if (value === 'π' || value === 'e') {
                        state.expression += (value === 'π') ? 'π' : 'e';
                        state.currentInput = (value === 'π') ? Math.PI.toString() : Math.E.toString();
                    } else if (value === '√') {
                        state.expression += '√(';
                        state.currentInput = '√';
                    } else {
                        // append function name and opening paren
                        state.expression += value + '(';
                        state.currentInput = value + '(';
                    }
                } else if (value === '!') {
                    state.expression += '!';
                    state.currentInput = '!';
                } else {
                    // Regular numbers and operators
                    if (state.currentInput === '0' && value !== '.') {
                        state.currentInput = value;
                    } else {
                        state.currentInput += value;
                    }
                    state.expression += value;
                }
        }

        updateDisplay();
    }

    // Convert currency
    function convertCurrency() {
        if (!elements.amount || !elements.fromCurrency || !elements.toCurrency || !elements.conversionResult || !elements.exchangeRate) return;

        const amount = parseFloat(elements.amount.value);
        const from = elements.fromCurrency.value;
        const to = elements.toCurrency.value;

        // Use manual rate if provided, otherwise use stored rates
        let rate = state.manualRate;
        if (!rate) {
            if (state.exchangeRates && state.exchangeRates[from] && state.exchangeRates[to]) {
                // rate = value of 'to' in USD divided by value of 'from' in USD
                rate = (state.exchangeRates[to] / state.exchangeRates[from]);
            } else {
                rate = NaN;
            }
        }

        if (isNaN(amount) || !isFinite(rate)) {
            elements.conversionResult.textContent = "Invalid input";
            return;
        }

        const result = amount * rate;
        elements.conversionResult.textContent = `${formatNumber(amount)} ${from} = ${formatNumber(result)} ${to}`;
        elements.exchangeRate.value = rate.toFixed(6);
    }

    // Fetch live exchange rates
    async function fetchExchangeRates() {
        if (!elements.rateInfo) return;

        try {
            const endpoints = [
                'https://api.frankfurter.app/latest?from=USD',
                'https://api.exchangerate.host/latest?base=USD'
            ];

            let ratesData = null;

            for (const endpoint of endpoints) {
                try {
                    const response = await fetch(endpoint);
                    if (response.ok) {
                        ratesData = await response.json();
                        break;
                    }
                } catch (error) {
                    console.log(`Failed to fetch from ${endpoint}`);
                }
            }

            if (ratesData) {
                const base = ratesData.base || ratesData.base_code || 'USD';
                const rates = ratesData.rates || {};

                // If endpoint uses "rates" that map currency->value relative to base
                // We'll normalize for our exchangeRates store so that exchangeRates[base] = 1
                Object.keys(state.exchangeRates).forEach(currency => {
                    if (currency === base) {
                        state.exchangeRates[currency] = 1;
                    } else if (rates[currency] !== undefined) {
                        // The APIs typically give rates[currency] as how much 1 base equals in that currency.
                        // To produce a "value relative to USD" that fits our original structure, we store 1 / rate
                        // only if we need to preserve the original structure. Simpler approach: we set them directly as rate.
                        state.exchangeRates[currency] = rates[currency];
                    }
                });

                state.lastRateUpdate = new Date();
                elements.rateInfo.textContent = `Last updated: ${state.lastRateUpdate.toLocaleString()}`;
            } else {
                throw new Error('All API endpoints failed');
            }
        } catch (error) {
            elements.rateInfo.textContent = 'Using fallback rates (network error)';
            console.log('Error fetching exchange rates', error);
        }

        // re-run conversion with updated rates
        convertCurrency();
    }

    // Handle 3D tilt effect
    function handleTiltEffect(e) {
        if (!state.is3DMode) return;
        if (!elements.calculator3d) return;

        const card = elements.calculator3d;
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateY = (x - centerX) / centerX * 10;
        const rotateX = (y - centerY) / centerY * -10;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    }

    // Reset tilt effect
    function resetTiltEffect() {
        if (state.is3DMode && elements.calculator3d) {
            elements.calculator3d.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
        }
    }

    // Toggle 3D mode
    function toggle3DMode() {
        state.is3DMode = !state.is3DMode;
        document.body.classList.toggle('enhanced-3d', state.is3DMode);
        saveSettings();
        update3DToggleButton();
    }

    // Update 3D toggle button appearance
    function update3DToggleButton() {
        if (!elements.mode3DToggle) return;
        elements.mode3DToggle.textContent = state.is3DMode ? '🔳' : '🔲';
    }

    // Toggle theme
    function toggleTheme() {
        state.isDarkTheme = !state.isDarkTheme;
        document.body.classList.toggle('light-theme', !state.isDarkTheme);
        saveSettings();
        updateThemeToggleButton();
    }

    // Update theme toggle button appearance
    function updateThemeToggleButton() {
        if (!elements.themeToggle) return;
        elements.themeToggle.textContent = state.isDarkTheme ? '🌓' : '🌞';
    }

    // Toggle sound
    function toggleSound() {
        state.soundEnabled = !state.soundEnabled;
        saveSettings();
        updateSoundToggleButton();
    }

    // Update sound toggle button appearance
    function updateSoundToggleButton() {
        if (!elements.soundToggle) return;
        elements.soundToggle.textContent = state.soundEnabled ? '🔊' : '🔇';
    }

    // Save settings to localStorage
    function saveSettings() {
        const settings = {
            soundEnabled: state.soundEnabled,
            is3DMode: state.is3DMode,
            isDarkTheme: state.isDarkTheme,
            isRadians: state.isRadians,
            exchangeRates: state.exchangeRates,
            lastRateUpdate: state.lastRateUpdate ? state.lastRateUpdate.toISOString() : null
        };
        try {
            localStorage.setItem('calculatorSettings', JSON.stringify(settings));
        } catch (e) {
            console.log('Could not save settings', e);
        }
    }

    // Load settings from localStorage
    function loadSettings() {
        const saved = localStorage.getItem('calculatorSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                state.soundEnabled = settings.soundEnabled !== undefined ? settings.soundEnabled : true;
                state.is3DMode = settings.is3DMode !== undefined ? settings.is3DMode : false;
                state.isDarkTheme = settings.isDarkTheme !== undefined ? settings.isDarkTheme : true;
                state.isRadians = settings.isRadians !== undefined ? settings.isRadians : false;

                if (settings.exchangeRates) {
                    state.exchangeRates = { ...state.exchangeRates, ...settings.exchangeRates };
                }

                if (settings.lastRateUpdate) {
                    state.lastRateUpdate = new Date(settings.lastRateUpdate);
                    if (elements.rateInfo) {
                        elements.rateInfo.textContent = `Last updated: ${state.lastRateUpdate.toLocaleString()}`;
                    }
                }
            } catch (error) {
                console.log("Error loading settings", error);
            }
        }

        // Apply loaded settings
        document.body.classList.toggle('light-theme', !state.isDarkTheme);
        document.body.classList.toggle('enhanced-3d', state.is3DMode);
        updateThemeToggleButton();
        updateSoundToggleButton();
        update3DToggleButton();
    }

    // Initialize the application
    function init() {
        // Load saved settings
        loadSettings();

        // Set up calculator button events
        document.querySelectorAll('.calc-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                // prefer dataset value, but fall back to textContent if dataset missing
                const val = e.currentTarget.dataset.value !== undefined ? e.currentTarget.dataset.value : e.currentTarget.textContent.trim();
                handleInput(val);
                e.currentTarget.classList.add('button-press');
                setTimeout(() => {
                    e.currentTarget.classList.remove('button-press');
                }, 100);
            });
        });

        // Set up currency converter events (guard if elements missing)
        if (elements.amount) elements.amount.addEventListener('input', convertCurrency);
        if (elements.fromCurrency) elements.fromCurrency.addEventListener('change', convertCurrency);
        if (elements.toCurrency) elements.toCurrency.addEventListener('change', convertCurrency);
        if (elements.exchangeRate) {
            elements.exchangeRate.addEventListener('input', function() {
                const parsed = parseFloat(this.value);
                state.manualRate = isNaN(parsed) ? null : parsed;
                convertCurrency();
            });
        }

        if (elements.useCalcValue) {
            elements.useCalcValue.addEventListener('click', function() {
                elements.amount.value = state.currentInput;
                convertCurrency();
            });
        }

        if (elements.updateRates) elements.updateRates.addEventListener('click', fetchExchangeRates);

        if (elements.swapCurrencies) {
            elements.swapCurrencies.addEventListener('click', function() {
                const temp = elements.fromCurrency.value;
                elements.fromCurrency.value = elements.toCurrency.value;
                elements.toCurrency.value = temp;
                convertCurrency();
            });
        }

        // Set up control buttons
        if (elements.themeToggle) elements.themeToggle.addEventListener('click', toggleTheme);
        if (elements.soundToggle) elements.soundToggle.addEventListener('click', toggleSound);
        if (elements.mode3DToggle) elements.mode3DToggle.addEventListener('click', toggle3DMode);

        // Set up 3D tilt effect
        if (elements.calculator3d) {
            elements.calculator3d.addEventListener('mousemove', handleTiltEffect);
            elements.calculator3d.addEventListener('mouseleave', resetTiltEffect);
        }

        // Set up help panel toggle
        if (elements.helpToggle && elements.helpContent) {
            elements.helpToggle.addEventListener('click', function() {
                elements.helpContent.classList.toggle('expanded');
                const span = this.querySelector('span');
                if (span) {
                    span.textContent = elements.helpContent.classList.contains('expanded') ? '▲' : '▼';
                }
            });
        }

        // Set up keyboard support
        document.addEventListener('keydown', function(e) {
            // Prevent default for keys we handle
            if (['Enter', 'Escape', 'Backspace', 'Delete'].includes(e.key)) {
                e.preventDefault();
            }

            // Calculator inputs
            if (/^[0-9\.\+\-\*\/]$/.test(e.key)) {
                handleInput(e.key);
            } else if (e.key === 'Enter') {
                handleInput('=');
            } else if (e.key === 'Escape') {
                handleInput('AC');
            } else if (e.key === 'Backspace' || e.key === 'Delete') {
                handleInput('⌫');
            } else if (e.key === '(' || e.key === ')') {
                handleInput(e.key);
            } else if (e.key.toLowerCase() === 't') {
                toggleTheme();
            }
        });

        // Initial currency conversion
        convertCurrency();

        // Optional: fetch exchange rates on start (comment in if you want live)
        // fetchExchangeRates();
    }

    // Start the application
    init();
});
