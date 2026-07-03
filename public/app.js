document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide Icons
  lucide.createIcons();

  // DOM Elements
  const apiKeyInput = document.getElementById('apiKey');
  const toggleApiKeyBtn = document.getElementById('toggleApiKey');
  const thesisForm = document.getElementById('thesisForm');
  const tickerInput = document.getElementById('ticker');
  const submitBtn = document.getElementById('submitBtn');
  const historyList = document.getElementById('historyList');

  // Dashboard states
  const emptyState = document.getElementById('emptyState');
  const loadingState = document.getElementById('loadingState');
  const resultsDashboard = document.getElementById('resultsDashboard');
  const errorState = document.getElementById('errorState');
  const uiErrorMessage = document.getElementById('errorMessage');
  const retryCountdown = document.getElementById('retryCountdown');
  const retryBtn = document.getElementById('retryBtn');
  const cancelRetryBtn = document.getElementById('cancelRetryBtn');

  const loadingMessage = document.getElementById('loadingMessage');

  // Loading Steps
  const stepYf = document.getElementById('step-yf');
  const stepSearch = document.getElementById('step-search');
  const stepLlm = document.getElementById('step-llm');
  const stepRr = document.getElementById('step-rr');

  // Results Dashboard Elements
  const resTicker = document.getElementById('resTicker');
  const resCompanyName = document.getElementById('resCompanyName');
  const resCurrentPrice = document.getElementById('resCurrentPrice');
  const resSavedPath = document.getElementById('resSavedPath');
  const resVerdictBadge = document.getElementById('resVerdictBadge');
  const resCentralThesis = document.getElementById('resCentralThesis');
  const resFavorList = document.getElementById('resFavorList');
  const resAgainstList = document.getElementById('resAgainstList');
  const resKillMetric = document.getElementById('resKillMetric');
  const resKillContext = document.getElementById('resKillContext');
  const resStopPrice = document.getElementById('resStopPrice');
  const resEntryPrice = document.getElementById('resEntryPrice');
  const resTargetPrice = document.getElementById('resTargetPrice');
  const resRrRatio = document.getElementById('resRrRatio');
  const resRrDescription = document.getElementById('resRrDescription');
  const resCitationsCard = document.getElementById('resCitationsCard');
  const resCitationsList = document.getElementById('resCitationsList');

  // Chart variables
  let priceChartInstance = null;
  let currentTicker = null;
  let currentChartPeriod = '6m';
  const chartCard = document.getElementById('chartCard');

  // Earnings card variables
  const earningsCard = document.getElementById('earningsCard');
  const resNextEarningsDate = document.getElementById('resNextEarningsDate');
  const resEarningsTag = document.getElementById('resEarningsTag');
  const resEpsHistory = document.getElementById('resEpsHistory');

  // Load API Key from localStorage
  const storedApiKey = localStorage.getItem('gemini_api_key');
  if (storedApiKey) {
    apiKeyInput.value = storedApiKey;
  }

  // Save API Key on input change
  apiKeyInput.addEventListener('input', () => {
    localStorage.setItem('gemini_api_key', apiKeyInput.value.trim());
  });

  // Toggle API Key visibility
  toggleApiKeyBtn.addEventListener('click', () => {
    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleApiKeyBtn.innerHTML = '<i data-lucide="eye-off"></i>';
    } else {
      apiKeyInput.type = 'password';
      toggleApiKeyBtn.innerHTML = '<i data-lucide="eye"></i>';
    }
    lucide.createIcons();
  });

  // Load History
  loadHistory();

  const modelSelect = document.getElementById('modelSelect');

  let retryTimerId = null;
  let countdownIntervalId = null;

  // Form Submission Handler
  const handleSubmission = async (e) => {
    if (e) e.preventDefault();
    
    // Clear any existing retry timers if we're manually submitting
    if (retryTimerId) clearTimeout(retryTimerId);
    if (countdownIntervalId) clearInterval(countdownIntervalId);

    const ticker = tickerInput.value.trim().toUpperCase();
    const apiKey = apiKeyInput.value.trim();
    const selectedModel = modelSelect.value;

    if (!ticker) {
      alert('Por favor, ingresa un ticker válido.');
      return;
    }

    if (!apiKey) {
      alert('Por favor, ingresa tu Gemini API Key en la parte superior.');
      apiKeyInput.focus();
      return;
    }

    // Show loading state
    emptyState.classList.add('hidden');
    resultsDashboard.classList.add('hidden');
    errorState.classList.add('hidden');
    loadingState.classList.remove('hidden');
    submitBtn.disabled = true;

    // Reset progress steps
    resetSteps();
    setStepActive(stepYf, 'Buscando datos financieros en Yahoo Finance...');

    // Start simulated progress steps inside loading state
    const progressTimer = startProgressSimulation();

    try {
      const response = await fetch('/api/generate-thesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, geminiApiKey: apiKey, model: selectedModel })
      });

      const data = await response.json();

      clearInterval(progressTimer);

      if (!response.ok) {
        throw new Error(data.error || 'Ocurrió un error inesperado.');
      }

      // Display results
      renderThesis(data);
      
      // Reload history list
      loadHistory();
      
      submitBtn.disabled = false;
    } catch (error) {
      clearInterval(progressTimer);
      console.error(error);
      
      let userMessage = error.message;
      let isRateLimit = false;
      if (error.message.includes('429') || error.message.includes('quota') || error.message.includes('503')) {
        isRateLimit = true;
        userMessage = `⚠️ El modelo "${selectedModel}" falló (${error.message}).\n\nEl servidor está experimentando alta demanda o te quedaste sin cuota temporalmente.`;
      }
      
      // Hide loading state
      loadingState.classList.add('hidden');
      
      // Show error state in the dashboard instead of alert
      errorState.classList.remove('hidden');
      uiErrorMessage.innerText = userMessage;
      
      // Start 20s countdown
      let secondsLeft = 20;
      retryCountdown.innerText = `Reintentando automáticamente en ${secondsLeft}s...`;
      
      countdownIntervalId = setInterval(() => {
        secondsLeft--;
        if (secondsLeft > 0) {
          retryCountdown.innerText = `Reintentando automáticamente en ${secondsLeft}s...`;
        } else {
          clearInterval(countdownIntervalId);
        }
      }, 1000);

      retryTimerId = setTimeout(() => {
        handleSubmission();
      }, 20000);
      
      submitBtn.disabled = false;
    }
  };

  thesisForm.addEventListener('submit', handleSubmission);

  // Retry buttons handlers
  retryBtn.addEventListener('click', handleSubmission);

  cancelRetryBtn.addEventListener('click', () => {
    if (retryTimerId) clearTimeout(retryTimerId);
    if (countdownIntervalId) clearInterval(countdownIntervalId);
    errorState.classList.add('hidden');
    emptyState.classList.remove('hidden');
  });

  // Loading Steps Helpers
  function resetSteps() {
    [stepYf, stepSearch, stepLlm, stepRr].forEach(step => {
      step.className = 'step';
      const icon = step.querySelector('i, svg');
      if (icon) {
        const newIcon = document.createElement('i');
        newIcon.setAttribute('data-lucide', 'circle');
        icon.replaceWith(newIcon);
      }
    });
    lucide.createIcons();
  }

  function setStepActive(stepElement, message) {
    stepElement.classList.add('active');
    loadingMessage.textContent = message;
  }

  function setStepCompleted(stepElement) {
    stepElement.classList.remove('active');
    stepElement.classList.add('completed');
    const icon = stepElement.querySelector('i, svg');
    if (icon) {
      const newIcon = document.createElement('i');
      newIcon.setAttribute('data-lucide', 'check-circle-2');
      icon.replaceWith(newIcon);
    }
    lucide.createIcons();
  }

  function startProgressSimulation() {
    let elapsed = 0;
    return setInterval(() => {
      elapsed += 1;
      if (elapsed === 4) {
        setStepCompleted(stepYf);
        setStepActive(stepSearch, 'Ejecutando Google Search grounding para buscar contra-tesis y riesgos...');
      } else if (elapsed === 9) {
        setStepCompleted(stepSearch);
        setStepActive(stepLlm, 'Analizando datos y redactando la tesis 3x3 en la IA...');
      } else if (elapsed === 14) {
        setStepCompleted(stepLlm);
        setStepActive(stepRr, 'Calculando relación Riesgo:Retorno y validando checklist...');
      }
    }, 1000);
  }

  // Load past theses
  async function loadHistory() {
    try {
      const response = await fetch('/api/tesis');
      const files = await response.json();

      if (files.length === 0) {
        historyList.innerHTML = '<div class="empty-history">No hay análisis guardados.</div>';
        return;
      }

      historyList.innerHTML = '';
      files.forEach(file => {
        const date = new Date(file.createdAt).toLocaleDateString('es-ES', {
          month: 'short',
          day: 'numeric'
        });
        
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
          <div>
            <div class="history-item-ticker">${file.ticker}</div>
            <div class="history-item-date">${date}</div>
          </div>
          <i data-lucide="chevron-right" style="width: 16px; height: 16px; color: var(--text-muted);"></i>
        `;

        div.addEventListener('click', () => loadSavedThesis(file.ticker));
        historyList.appendChild(div);
      });
      lucide.createIcons();
    } catch (error) {
      console.error('Error loading history:', error);
      historyList.innerHTML = '<div class="empty-history">Error al cargar historial.</div>';
    }
  }

  // Load a saved thesis JSON
  async function loadSavedThesis(ticker) {
    try {
      emptyState.classList.add('hidden');
      resultsDashboard.classList.add('hidden');
      loadingState.classList.remove('hidden');
      resetSteps();
      setStepActive(stepYf, `Cargando tesis guardada de ${ticker}...`);

      const response = await fetch(`/tesis/${ticker}.json`);
      if (!response.ok) {
        throw new Error('No se pudo encontrar el archivo de datos JSON.');
      }
      const data = await response.json();
      
      // Update UI active history state
      document.querySelectorAll('.history-item').forEach(item => {
        const itemTicker = item.querySelector('.history-item-ticker').textContent;
        if (itemTicker === ticker) {
          item.classList.add('active');
        } else {
          item.classList.remove('active');
        }
      });

      renderThesis(data);
    } catch (error) {
      console.error(error);
      alert(`Error al cargar la tesis guardada: ${error.message}`);
      loadingState.classList.add('hidden');
      emptyState.classList.remove('hidden');
    }
  }

  // Render Thesis data to UI
  function renderThesis(data) {
    loadingState.classList.add('hidden');
    resultsDashboard.classList.remove('hidden');

    // Header info
    resTicker.textContent = data.ticker || 'N/A';
    resCompanyName.textContent = data.companyName || 'Empresa';
    resCurrentPrice.textContent = data.currentPrice ? `$${data.currentPrice.toFixed(2)}` : 'No disponible';
    
    // Save path
    const filename = data.filename || `${data.ticker}.md`;
    resSavedPath.textContent = filename;
    
    // Verdict
    resVerdictBadge.className = 'verdict-badge';
    if (data.riskRewardRatio && data.riskRewardRatio >= 2.0) {
      resVerdictBadge.textContent = 'APROBADO';
      resVerdictBadge.classList.add('approved');
    } else {
      resVerdictBadge.textContent = 'RECHAZADO';
      resVerdictBadge.classList.add('rejected');
    }

    // Central Thesis
    resCentralThesis.textContent = data.centralThesis;

    // 3 Reasons In Favor
    resFavorList.innerHTML = '';
    data.reasonsInFavor.forEach((reason) => {
      const item = document.createElement('div');
      item.className = 'reason-item';
      item.innerHTML = `
        <h4>${reason.title}</h4>
        <p>${reason.description}</p>
      `;
      resFavorList.appendChild(item);
    });

    // 2 Reasons Against
    resAgainstList.innerHTML = '';
    data.reasonsAgainst.forEach((reason) => {
      const item = document.createElement('div');
      item.className = 'reason-item';
      item.innerHTML = `
        <h4>${reason.title}</h4>
        <p>${reason.description}</p>
      `;
      resAgainstList.appendChild(item);
    });

    // 1 Kill Switch
    resKillMetric.textContent = data.killSwitch.metricComponent;
    resKillContext.textContent = data.killSwitch.contextComponent;

    // Checklist
    toggleChecklist('chk-favor', data.reasonsInFavor && data.reasonsInFavor.length === 3);
    toggleChecklist('chk-against', data.reasonsAgainst && data.reasonsAgainst.length === 2);
    toggleChecklist('chk-kill', data.killSwitch.metricComponent && data.killSwitch.contextComponent);
    toggleChecklist('chk-rr', data.riskRewardRatio && data.riskRewardRatio >= 2.0);

    // Risk:Reward Prices
    const entryPrice = data.currentPrice || 0;
    const targetPrice = data.suggestedTargetPrice || 0;
    const stopPrice = data.suggestedInvalidationPrice || 0;

    resEntryPrice.textContent = entryPrice ? `$${entryPrice.toFixed(2)}` : 'N/A';
    resTargetPrice.textContent = targetPrice ? `$${targetPrice.toFixed(2)}` : 'N/A';
    resStopPrice.textContent = stopPrice ? `$${stopPrice.toFixed(2)}` : 'N/A';

    // R:R Ratio description and circle
    if (data.riskRewardRatio) {
      resRrRatio.textContent = `1:${data.riskRewardRatio.toFixed(2)}`;
      const rewardDiff = targetPrice - entryPrice;
      const riskDiff = entryPrice - stopPrice;
      resRrDescription.textContent = `El beneficio potencial de esta operación ($${rewardDiff.toFixed(2)}) es ${data.riskRewardRatio.toFixed(2)} veces mayor que el riesgo asumido ($${riskDiff.toFixed(2)}).`;
    } else {
      resRrRatio.textContent = 'N/A';
      resRrDescription.textContent = 'No se puede calcular el R:R debido a falta de datos de precios.';
    }

    // Update Slider Gauge
    updateGauge(entryPrice, targetPrice, stopPrice);

    // Renderizar earnings info
    if (data.nextEarningsDate?.length > 0 || data.epsHistory?.length > 0) {
      earningsCard.classList.remove('hidden');

      // Próxima fecha de earnings
      if (data.nextEarningsDate?.length > 0) {
        const d = new Date(data.nextEarningsDate[0]);
        resNextEarningsDate.textContent = d.toLocaleDateString('es-ES', {
          day: 'numeric', month: 'short', year: 'numeric'
        });
        resEarningsTag.textContent = data.isEarningsEstimate ? 'Fecha estimada' : 'Fecha confirmada';
        resEarningsTag.style.background = data.isEarningsEstimate
          ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)';
        resEarningsTag.style.color = data.isEarningsEstimate ? '#f59e0b' : '#10b981';
        resEarningsTag.style.borderColor = data.isEarningsEstimate
          ? 'rgba(245,158,11,0.3)' : 'rgba(16,185,129,0.3)';
      }

      // Historial de sorpresas EPS
      if (data.epsHistory?.length > 0) {
        resEpsHistory.innerHTML = '';
        data.epsHistory.forEach(h => {
          const beat = h.surprisePct >= 0;
          const pct = h.surprisePct != null ? `${beat ? '+' : ''}${(h.surprisePct * 100).toFixed(1)}%` : '—';
          const qDate = h.quarter ? new Date(h.quarter).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }) : h.period;
          const item = document.createElement('div');
          item.className = `eps-item ${beat ? 'beat' : 'miss'}`;
          item.innerHTML = `
            <span class="eps-quarter">${qDate}</span>
            <span class="eps-surprise">${pct}</span>
            <span class="eps-values">Real: $${h.epsActual?.toFixed(2) ?? '—'}<br>Est: $${h.epsEstimate?.toFixed(2) ?? '—'}</span>
          `;
          resEpsHistory.appendChild(item);
        });
      }
    } else {
      earningsCard.classList.add('hidden');
    }

    // Load and render price chart with moving averages
    loadPriceChart(data.ticker);

    // Citations list
    if (data.citations && data.citations.length > 0) {
      resCitationsCard.classList.remove('hidden');
      resCitationsList.innerHTML = '';
      data.citations.forEach(cit => {
        const link = document.createElement('a');
        link.className = 'citation-chip';
        link.href = cit.url;
        link.target = '_blank';
        
        let hostname = 'Fuente';
        try {
          hostname = new URL(cit.url).hostname.replace('www.', '');
        } catch(e) {}
        
        link.innerHTML = `
          <i data-lucide="external-link"></i>
          <span title="${cit.title}">${cit.title} (${hostname})</span>
        `;
        resCitationsList.appendChild(link);
      });
    } else {
      resCitationsCard.classList.add('hidden');
    }

    lucide.createIcons();
  }

  function toggleChecklist(id, completed) {
    const el = document.getElementById(id);
    if (!el) return;
    
    if (completed) {
      el.classList.add('checked');
    } else {
      el.classList.remove('checked');
    }
    
    const icon = el.querySelector('i, svg');
    if (icon) {
      const newIcon = document.createElement('i');
      newIcon.setAttribute('data-lucide', completed ? 'check-square' : 'square');
      icon.replaceWith(newIcon);
    }
    lucide.createIcons();
  }

  function updateGauge(entry, target, stop) {
    const marker = document.querySelector('.current-marker');
    const invZone = document.querySelector('.gauge-invalidation-zone');
    const targetZone = document.querySelector('.gauge-target-zone');

    if (!entry || !target || !stop || target <= stop) {
      marker.style.left = '50%';
      invZone.style.width = '50%';
      targetZone.style.width = '50%';
      return;
    }

    const totalRange = target - stop;
    const invPercent = ((entry - stop) / totalRange) * 100;
    
    // Constrain percentages between 5% and 95% for display safety
    const safePercent = Math.min(Math.max(invPercent, 5), 95);

    marker.style.left = `${safePercent}%`;
    invZone.style.width = `${safePercent}%`;
    targetZone.style.width = `${100 - safePercent}%`;
  }

  // Load and render price chart with moving averages
  async function loadPriceChart(ticker, period = '6m') {
    // Save the current ticker for period button changes
    currentTicker = ticker;
    currentChartPeriod = period;

    chartCard.classList.add('hidden');
    try {
      const resp = await fetch(`/api/chart/${ticker}?period=${period}`);
      if (!resp.ok) return;
      const { dates, closes, ma50, ma200 } = await resp.json();

      chartCard.classList.remove('hidden');

      // Destruir gráfico anterior si existe
      if (priceChartInstance) {
        priceChartInstance.destroy();
        priceChartInstance = null;
      }

      const ctx = document.getElementById('priceChart').getContext('2d');
      priceChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: dates,
          datasets: [
            {
              label: 'Cierre',
              data: closes,
              borderColor: 'rgba(255,255,255,0.7)',
              borderWidth: 1.5,
              pointRadius: 0,
              tension: 0.1,
              fill: false
            },
            {
              label: 'MA50',
              data: ma50,
              borderColor: '#6366f1',
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.3,
              fill: false
            },
            {
              label: 'MA200',
              data: ma200,
              borderColor: '#10b981',
              borderWidth: 2,
              pointRadius: 0,
              tension: 0.3,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(22,30,49,0.95)',
              titleColor: '#e2e8f0',
              bodyColor: '#94a3b8',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#64748b', maxTicksLimit: 8 }
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#64748b', callback: v => `$${v.toFixed(0)}` }
            }
          }
        }
      });

      lucide.createIcons();

      // Add event listeners to period buttons (only once)
      setupPeriodButtons();
    } catch (err) {
      console.warn('[Chart] No se pudo cargar el gráfico:', err);
    }
  }

  // Setup period button event listeners
  function setupPeriodButtons() {
    const periodButtons = document.querySelectorAll('.period-btn');
    periodButtons.forEach(btn => {
      // Remove existing listeners by cloning
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
    });

    // Re-query after replacement
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const newPeriod = btn.getAttribute('data-period');

        // Update active button
        document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        // Reload chart with new period
        await loadPriceChart(currentTicker, newPeriod);
      });
    });
  }
});
