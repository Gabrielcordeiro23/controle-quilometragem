(function () {
  'use strict';

  const STORAGE_KEY = 'controle_km_beta_v1';

  const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const WEEKDAYS = [
    'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
    'Quinta-feira', 'Sexta-feira', 'Sábado'
  ];

  const WEEKDAYS_SHORT = [
    'Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'
  ];

  // Estado da aplicação (inicia sempre na data de hoje do dispositivo)
  const now = new Date();
  const state = {
    driverName: '',
    year: now.getFullYear(),
    month: now.getMonth(), // 0 a 11
    selectedDay: now.getDate(),
    onlyFilled: false,
    records: {} // Formato: "YYYY-MM": { "1": { kmStart: 342670, kmEnd: 342690, km: 20, note: "Centro" } }
  };

  // Elementos do DOM
  const elements = {
    driverName: document.getElementById('driverName'),
    selectMonth: document.getElementById('selectMonth'),
    selectYear: document.getElementById('selectYear'),
    btnGoToday: document.getElementById('btnGoToday'),
    totalKmMonth: document.getElementById('totalKmMonth'),
    daysRecordedMonth: document.getElementById('daysRecordedMonth'),
    avgKmMonth: document.getElementById('avgKmMonth'),
    formCard: document.getElementById('formCard'),
    entryForm: document.getElementById('entryForm'),
    btnPrevDay: document.getElementById('btnPrevDay'),
    btnNextDay: document.getElementById('btnNextDay'),
    entryDay: document.getElementById('entryDay'),
    entryKmStart: document.getElementById('entryKmStart'),
    entryKmEnd: document.getElementById('entryKmEnd'),
    currentDayBox: document.getElementById('currentDayBox'),
    currentDayLabel: document.getElementById('currentDayLabel'),
    currentDayKmValue: document.getElementById('currentDayKmValue'),
    currentDayStatusText: document.getElementById('currentDayStatusText'),
    entryNote: document.getElementById('entryNote'),
    formFeedback: document.getElementById('formFeedback'),
    btnSubmitEntry: document.getElementById('btnSubmitEntry'),
    btnClearDay: document.getElementById('btnClearDay'),
    sheetPeriodLabel: document.getElementById('sheetPeriodLabel'),
    toggleOnlyFilled: document.getElementById('toggleOnlyFilled'),
    btnGeneratePdf: document.getElementById('btnGeneratePdf'),
    sheetBody: document.getElementById('sheetBody'),
    tfootTotalKm: document.getElementById('tfootTotalKm'),
    // Modal de confirmação
    confirmModal: document.getElementById('confirmModal'),
    modalMessage: document.getElementById('modalMessage'),
    modalPreview: document.getElementById('modalPreview'),
    btnCancelDelete: document.getElementById('btnCancelDelete'),
    btnConfirmDelete: document.getElementById('btnConfirmDelete'),
    // Elementos de impressão / PDF
    printPeriod: document.getElementById('printPeriod'),
    printDriverName: document.getElementById('printDriverName'),
    printGeneratedAt: document.getElementById('printGeneratedAt'),
    printTotalKm: document.getElementById('printTotalKm'),
    printDaysRecorded: document.getElementById('printDaysRecorded'),
    printAvgKm: document.getElementById('printAvgKm'),
    printTableBody: document.getElementById('printTableBody'),
    printTfootTotal: document.getElementById('printTfootTotal')
  };

  // Utilitários
  function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function getWeekdayName(year, month, day) {
    const date = new Date(year, month, day);
    return WEEKDAYS[date.getDay()];
  }

  function getWeekdayShort(year, month, day) {
    const date = new Date(year, month, day);
    return WEEKDAYS_SHORT[date.getDay()];
  }

  function getPeriodKey(year, month) {
    const m = String(month + 1).padStart(2, '0');
    return `${year}-${m}`;
  }

  function pad2(num) {
    return String(num).padStart(2, '0');
  }

  function formatKm(value) {
    const num = Number(value) || 0;
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    }) + ' km';
  }

  function formatOdometer(value) {
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) {
      return '—';
    }
    return Number(value).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1
    });
  }

  function formatRawOdometerInput(value) {
    if (value === null || value === undefined || value === '' || !Number.isFinite(Number(value))) {
      return '';
    }
    const num = Number(value);
    if (Number.isInteger(num)) {
      return String(num);
    }
    return String(num).replace('.', ',');
  }

  // Interpreta valores de hodômetro como "342670", "342.670" ou "342670,5"
  function parseOdometerInput(raw) {
    if (typeof raw !== 'string') return null;
    const cleaned = raw.trim().replace(/\s+/g, '');
    if (!cleaned) return null;

    let normalized = cleaned;
    if (cleaned.includes(',')) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
      // Ponto usado como separador de milhar (ex: 342.670 -> 342670)
      normalized = cleaned.replace(/\./g, '');
    }

    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) return NaN;
    return Math.round(parsed * 10) / 10;
  }

  // Solicita persistência duradoura no navegador do celular/computador
  function requestPersistentStorage() {
    if (navigator.storage && typeof navigator.storage.persist === 'function') {
      navigator.storage.persist().catch(() => {});
    }
  }

  // Persistência Local no Dispositivo
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.driverName === 'string') {
          state.driverName = parsed.driverName;
        }
        if (parsed.records && typeof parsed.records === 'object') {
          state.records = parsed.records;
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados do dispositivo:', err);
    }
  }

  function saveState() {
    try {
      const payload = {
        driverName: state.driverName,
        records: state.records,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (err) {
      console.error('Erro ao salvar dados no dispositivo:', err);
    }
  }

  function getMonthRecords(year, month) {
    const key = getPeriodKey(year, month);
    return state.records[key] || {};
  }

  function getDayRecord(year, month, day) {
    const monthRecords = getMonthRecords(year, month);
    return monthRecords[String(day)] || null;
  }

  function hasDayData(rec) {
    if (!rec) return false;
    const hasStart = rec.kmStart !== null && rec.kmStart !== undefined && Number.isFinite(Number(rec.kmStart));
    const hasEnd = rec.kmEnd !== null && rec.kmEnd !== undefined && Number.isFinite(Number(rec.kmEnd));
    const hasKm = Number(rec.km) > 0;
    const hasNote = Boolean(rec.note && rec.note.trim());
    return hasStart || hasEnd || hasKm || hasNote;
  }

  function setDayRecord(year, month, day, kmStart, kmEnd, note) {
    const key = getPeriodKey(year, month);
    if (!state.records[key]) {
      state.records[key] = {};
    }

    const cleanNote = (note || '').trim();
    const validStart = kmStart !== null && Number.isFinite(kmStart) ? kmStart : null;
    const validEnd = kmEnd !== null && Number.isFinite(kmEnd) ? kmEnd : null;

    let distance = 0;
    if (validStart !== null && validEnd !== null && validEnd >= validStart) {
      distance = Math.round((validEnd - validStart) * 10) / 10;
    }

    if (validStart === null && validEnd === null && !cleanNote) {
      delete state.records[key][String(day)];
    } else {
      state.records[key][String(day)] = {
        kmStart: validStart,
        kmEnd: validEnd,
        km: distance,
        note: cleanNote
      };
    }
    saveState();
  }

  function deleteDayRecord(year, month, day) {
    const key = getPeriodKey(year, month);
    if (state.records[key] && state.records[key][String(day)]) {
      delete state.records[key][String(day)];
      saveState();
    }
  }

  // Feedback visual
  let feedbackTimer = null;
  function showFeedback(message, isError = false) {
    if (feedbackTimer) clearTimeout(feedbackTimer);
    elements.formFeedback.textContent = message;
    elements.formFeedback.classList.toggle('error', Boolean(isError));
    if (message) {
      feedbackTimer = setTimeout(() => {
        elements.formFeedback.textContent = '';
        elements.formFeedback.classList.remove('error');
      }, 4500);
    }
  }

  // Inicializa os seletores de Mês, Ano e Nome
  function initSelectors() {
    elements.selectMonth.innerHTML = '';
    MONTHS.forEach((name, index) => {
      const opt = document.createElement('option');
      opt.value = String(index);
      opt.textContent = name;
      elements.selectMonth.appendChild(opt);
    });

    elements.selectMonth.value = String(state.month);
    elements.selectYear.value = String(state.year);
    elements.driverName.value = state.driverName;
  }

  function populateDaySelect() {
    const daysCount = getDaysInMonth(state.year, state.month);
    if (state.selectedDay > daysCount) {
      state.selectedDay = daysCount;
    }
    if (state.selectedDay < 1) {
      state.selectedDay = 1;
    }

    elements.entryDay.innerHTML = '';
    const monthRecords = getMonthRecords(state.year, state.month);

    for (let d = 1; d <= daysCount; d++) {
      const weekdayShort = getWeekdayShort(state.year, state.month, d);
      const rec = monthRecords[String(d)];
      const hasRecord = hasDayData(rec);
      const opt = document.createElement('option');
      opt.value = String(d);
      opt.textContent = `${pad2(d)}/${pad2(state.month + 1)} (${weekdayShort})${hasRecord ? ' • Salvo' : ''}`;
      elements.entryDay.appendChild(opt);
    }

    elements.entryDay.value = String(state.selectedDay);
    elements.btnPrevDay.disabled = state.selectedDay <= 1;
    elements.btnNextDay.disabled = state.selectedDay >= daysCount;
  }

  // Carrega os dados salvos do dia selecionado nos campos
  function loadSelectedDayIntoForm() {
    const record = getDayRecord(state.year, state.month, state.selectedDay);
    const dateStr = `${pad2(state.selectedDay)}/${pad2(state.month + 1)}`;

    if (record) {
      elements.entryKmStart.value = formatRawOdometerInput(record.kmStart);
      elements.entryKmEnd.value = formatRawOdometerInput(record.kmEnd);
      elements.entryNote.value = record.note || '';
    } else {
      elements.entryKmStart.value = '';
      elements.entryKmEnd.value = '';
      elements.entryNote.value = '';
    }

    elements.btnSubmitEntry.textContent = `Salvar registro do dia ${dateStr}`;
    updateLiveCalculation();
  }

  // Atualiza em tempo real o cálculo de KM Rodado (KM Final - KM Inicial)
  function updateLiveCalculation() {
    const rawStart = elements.entryKmStart.value;
    const rawEnd = elements.entryKmEnd.value;
    const dateFormatted = `${pad2(state.selectedDay)}/${pad2(state.month + 1)}/${state.year}`;

    const kmStart = parseOdometerInput(rawStart);
    const kmEnd = parseOdometerInput(rawEnd);

    elements.currentDayBox.classList.remove('status-invalid');
    elements.currentDayLabel.textContent = `Percurso no dia ${dateFormatted}`;

    if (Number.isNaN(kmStart) || Number.isNaN(kmEnd)) {
      elements.currentDayBox.classList.add('status-invalid');
      elements.currentDayKmValue.textContent = 'Valor inválido';
      elements.currentDayStatusText.textContent = 'Digite apenas números no KM Inicial e no KM Final.';
      return;
    }

    if (kmStart !== null && kmEnd !== null) {
      if (kmEnd < kmStart) {
        elements.currentDayBox.classList.add('status-invalid');
        elements.currentDayKmValue.textContent = 'Verifique o KM';
        elements.currentDayStatusText.textContent =
          `O KM Final (${formatOdometer(kmEnd)}) não pode ser menor que o KM Inicial (${formatOdometer(kmStart)}).`;
        return;
      }
      const diff = Math.round((kmEnd - kmStart) * 10) / 10;
      elements.currentDayKmValue.textContent = formatKm(diff);
      elements.currentDayStatusText.textContent =
        `Cálculo automático: ${formatOdometer(kmEnd)} (final) − ${formatOdometer(kmStart)} (inicial) = ${formatKm(diff)} rodados.`;
    } else if (kmStart !== null && kmEnd === null) {
      elements.currentDayKmValue.textContent = 'Em aberto';
      elements.currentDayStatusText.textContent =
        `KM Inicial (${formatOdometer(kmStart)}) anotado. Você já pode salvar agora e preencher o KM Final no fim do dia.`;
    } else if (kmStart === null && kmEnd !== null) {
      elements.currentDayKmValue.textContent = 'Falta KM Inicial';
      elements.currentDayStatusText.textContent =
        `KM Final (${formatOdometer(kmEnd)}) preenchido. Informe também o KM Inicial do dia para calcular a distância.`;
    } else {
      elements.currentDayKmValue.textContent = '0 km';
      elements.currentDayStatusText.textContent =
        'Preencha o KM Inicial ao sair e o KM Final ao encerrar o dia para calcular os quilômetros rodados.';
    }
  }

  function calculateMonthStats(year, month) {
    const daysCount = getDaysInMonth(year, month);
    const monthRecords = getMonthRecords(year, month);

    let totalKm = 0;
    let daysRecorded = 0;

    for (let d = 1; d <= daysCount; d++) {
      const rec = monthRecords[String(d)];
      if (rec) {
        const kmVal = Number(rec.km) || 0;
        totalKm += kmVal;
        if (kmVal > 0 || (rec.kmStart !== null && rec.kmEnd !== null)) {
          daysRecorded += 1;
        }
      }
    }

    const avgKm = daysRecorded > 0 ? totalKm / daysRecorded : 0;
    return {
      totalKm: Math.round(totalKm * 10) / 10,
      daysRecorded,
      avgKm: Math.round(avgKm * 10) / 10
    };
  }

  function renderSummary() {
    const stats = calculateMonthStats(state.year, state.month);
    elements.totalKmMonth.textContent = formatKm(stats.totalKm);
    elements.daysRecordedMonth.textContent = String(stats.daysRecorded);
    elements.avgKmMonth.textContent = formatKm(stats.avgKm);
    elements.tfootTotalKm.textContent = formatKm(stats.totalKm);
    elements.sheetPeriodLabel.textContent = `${MONTHS[state.month]} de ${state.year}`;
  }

  function formatOdometerSummaryLine(rec) {
    if (!rec) return '';
    const hasStart = rec.kmStart !== null && rec.kmStart !== undefined;
    const hasEnd = rec.kmEnd !== null && rec.kmEnd !== undefined;
    if (hasStart && hasEnd) {
      return `Inicial: ${formatOdometer(rec.kmStart)} | Final: ${formatOdometer(rec.kmEnd)}`;
    }
    if (hasStart) {
      return `Inicial: ${formatOdometer(rec.kmStart)} | Final: em aberto`;
    }
    if (hasEnd) {
      return `Inicial: — | Final: ${formatOdometer(rec.kmEnd)}`;
    }
    return '';
  }

  function renderTable() {
    const daysCount = getDaysInMonth(state.year, state.month);
    const monthRecords = getMonthRecords(state.year, state.month);
    const monthNumber = pad2(state.month + 1);

    elements.sheetBody.innerHTML = '';
    let renderedRows = 0;

    for (let d = 1; d <= daysCount; d++) {
      const rec = monthRecords[String(d)];
      const hasData = hasDayData(rec);

      if (state.onlyFilled && !hasData) {
        continue;
      }

      renderedRows += 1;
      const tr = document.createElement('tr');
      tr.className = hasData ? 'row-filled' : 'row-empty';
      if (d === state.selectedDay) {
        tr.classList.add('row-selected');
      }

      const tdDay = document.createElement('td');
      tdDay.className = 'col-day';
      tdDay.innerHTML = `${pad2(d)}/${monthNumber}<span class="day-cell-sub">${getWeekdayShort(state.year, state.month, d)}</span>`;

      const tdWeekday = document.createElement('td');
      tdWeekday.className = 'col-weekday';
      tdWeekday.textContent = getWeekdayName(state.year, state.month, d);

      const tdNote = document.createElement('td');
      tdNote.className = 'col-note';
      const noteText = hasData && rec.note ? escapeHtml(rec.note) : '—';
      const odoLine = hasData ? formatOdometerSummaryLine(rec) : '';
      tdNote.innerHTML = odoLine
        ? `${noteText}<span class="odometer-sub">${escapeHtml(odoLine)}</span>`
        : noteText;

      const tdKm = document.createElement('td');
      tdKm.className = 'col-km';
      if (hasData && rec.kmStart !== null && rec.kmEnd === null) {
        tdKm.textContent = 'Aberto';
      } else {
        tdKm.textContent = hasData ? formatKm(rec.km) : '0 km';
      }

      const tdAction = document.createElement('td');
      tdAction.className = 'col-action';
      const btnSelect = document.createElement('button');
      btnSelect.type = 'button';
      btnSelect.className = 'btn-table';
      btnSelect.textContent = d === state.selectedDay ? 'Ativo' : 'Abrir';
      btnSelect.addEventListener('click', () => {
        selectDay(d, true);
      });
      tdAction.appendChild(btnSelect);

      tr.appendChild(tdDay);
      tr.appendChild(tdWeekday);
      tr.appendChild(tdNote);
      tr.appendChild(tdKm);
      tr.appendChild(tdAction);

      elements.sheetBody.appendChild(tr);
    }

    if (renderedRows === 0) {
      const emptyTr = document.createElement('tr');
      const hiddenTd = document.createElement('td');
      hiddenTd.className = 'col-weekday';
      const emptyTd = document.createElement('td');
      emptyTd.colSpan = 4;
      emptyTd.style.textAlign = 'center';
      emptyTd.style.padding = '1.5rem 0.5rem';
      emptyTd.style.color = 'var(--text-muted)';
      emptyTd.textContent = 'Nenhum deslocamento registrado neste mês até o momento.';
      emptyTr.appendChild(hiddenTd);
      emptyTr.appendChild(emptyTd);
      elements.sheetBody.appendChild(emptyTr);
    }
  }

  function renderPrintReport() {
    const daysCount = getDaysInMonth(state.year, state.month);
    const monthRecords = getMonthRecords(state.year, state.month);
    const stats = calculateMonthStats(state.year, state.month);
    const monthNumber = pad2(state.month + 1);

    const name = state.driverName.trim() || 'Não informado';
    elements.printDriverName.textContent = name;
    elements.printPeriod.textContent = `${MONTHS[state.month]} de ${state.year}`;

    const currentMoment = new Date();
    elements.printGeneratedAt.textContent = currentMoment.toLocaleDateString('pt-BR') +
      ' às ' + currentMoment.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    elements.printTotalKm.textContent = formatKm(stats.totalKm);
    elements.printDaysRecorded.textContent = String(stats.daysRecorded);
    elements.printAvgKm.textContent = formatKm(stats.avgKm);
    elements.printTfootTotal.textContent = formatKm(stats.totalKm);

    elements.printTableBody.innerHTML = '';

    for (let d = 1; d <= daysCount; d++) {
      const rec = monthRecords[String(d)];
      const hasData = hasDayData(rec);

      const tr = document.createElement('tr');

      const tdDate = document.createElement('td');
      tdDate.textContent = `${pad2(d)}/${monthNumber}/${state.year}`;

      const tdWeekday = document.createElement('td');
      tdWeekday.textContent = getWeekdayName(state.year, state.month, d);

      const tdNote = document.createElement('td');
      tdNote.textContent = hasData && rec.note ? rec.note : '—';

      const tdKmStart = document.createElement('td');
      tdKmStart.style.textAlign = 'right';
      tdKmStart.textContent = hasData ? formatOdometer(rec.kmStart) : '—';

      const tdKmEnd = document.createElement('td');
      tdKmEnd.style.textAlign = 'right';
      tdKmEnd.textContent = hasData ? formatOdometer(rec.kmEnd) : '—';

      const tdKm = document.createElement('td');
      tdKm.style.textAlign = 'right';
      tdKm.style.fontWeight = hasData && rec.km > 0 ? '600' : '400';
      tdKm.textContent = hasData ? formatKm(rec.km) : '0 km';

      tr.appendChild(tdDate);
      tr.appendChild(tdWeekday);
      tr.appendChild(tdNote);
      tr.appendChild(tdKmStart);
      tr.appendChild(tdKmEnd);
      tr.appendChild(tdKm);

      elements.printTableBody.appendChild(tr);
    }
  }

  function refreshUI(reloadForm = true) {
    populateDaySelect();
    if (reloadForm) {
      loadSelectedDayIntoForm();
    } else {
      updateLiveCalculation();
    }
    renderSummary();
    renderTable();
    renderPrintReport();
  }

  function selectDay(day, scrollToForm) {
    state.selectedDay = Number(day);
    refreshUI(true);
    if (scrollToForm && elements.formCard) {
      elements.formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Modal de confirmação para limpar o dia
  function openDeleteModal() {
    const record = getDayRecord(state.year, state.month, state.selectedDay);
    const hasRecord = hasDayData(record);
    const dateStr = `${pad2(state.selectedDay)}/${pad2(state.month + 1)}/${state.year}`;

    if (!hasRecord) {
      elements.entryKmStart.value = '';
      elements.entryKmEnd.value = '';
      elements.entryNote.value = '';
      updateLiveCalculation();
      showFeedback(`O dia ${dateStr} já está sem registros salvos.`);
      return;
    }

    elements.modalMessage.textContent =
      `Tem certeza de que deseja apagar todos os dados registrados no dia ${dateStr}?`;
    elements.modalPreview.innerHTML =
      `<strong>KM Inicial:</strong> ${formatOdometer(record.kmStart)} | <strong>KM Final:</strong> ${formatOdometer(record.kmEnd)}<br>` +
      `<strong>Total rodado:</strong> ${formatKm(record.km)}<br>` +
      `<strong>Observação:</strong> ${record.note ? escapeHtml(record.note) : '—'}`;

    elements.confirmModal.hidden = false;
  }

  function closeDeleteModal() {
    elements.confirmModal.hidden = true;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Eventos
  function bindEvents() {
    elements.driverName.addEventListener('input', (e) => {
      state.driverName = e.target.value;
      saveState();
      elements.printDriverName.textContent = state.driverName.trim() || 'Não informado';
    });

    elements.selectMonth.addEventListener('change', (e) => {
      state.month = Number(e.target.value);
      refreshUI(true);
    });

    elements.selectYear.addEventListener('input', (e) => {
      const y = parseInt(e.target.value, 10);
      if (Number.isFinite(y) && y >= 2000 && y <= 2100) {
        state.year = y;
        refreshUI(true);
      }
    });

    elements.selectYear.addEventListener('change', (e) => {
      let y = parseInt(e.target.value, 10);
      if (!Number.isFinite(y) || y < 2000) y = 2000;
      if (y > 2100) y = 2100;
      state.year = y;
      elements.selectYear.value = String(y);
      refreshUI(true);
    });

    elements.btnGoToday.addEventListener('click', () => {
      const today = new Date();
      state.year = today.getFullYear();
      state.month = today.getMonth();
      state.selectedDay = today.getDate();
      elements.selectMonth.value = String(state.month);
      elements.selectYear.value = String(state.year);
      refreshUI(true);
      showFeedback(`Selecionado o dia de hoje (${pad2(state.selectedDay)}/${pad2(state.month + 1)}/${state.year}).`);
    });

    elements.entryDay.addEventListener('change', (e) => {
      state.selectedDay = Number(e.target.value);
      refreshUI(true);
    });

    elements.btnPrevDay.addEventListener('click', () => {
      if (state.selectedDay > 1) {
        state.selectedDay -= 1;
        refreshUI(true);
      }
    });

    elements.btnNextDay.addEventListener('click', () => {
      const daysCount = getDaysInMonth(state.year, state.month);
      if (state.selectedDay < daysCount) {
        state.selectedDay += 1;
        refreshUI(true);
      }
    });

    // Cálculo automático enquanto o técnico digita KM Inicial e KM Final
    elements.entryKmStart.addEventListener('input', updateLiveCalculation);
    elements.entryKmEnd.addEventListener('input', updateLiveCalculation);

    // Salvamento do formulário
    elements.entryForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const rawStart = elements.entryKmStart.value;
      const rawEnd = elements.entryKmEnd.value;
      const note = elements.entryNote.value.trim();

      const kmStart = parseOdometerInput(rawStart);
      const kmEnd = parseOdometerInput(rawEnd);

      if (Number.isNaN(kmStart)) {
        showFeedback('Informe um número válido para o KM Inicial.', true);
        elements.entryKmStart.focus();
        return;
      }

      if (Number.isNaN(kmEnd)) {
        showFeedback('Informe um número válido para o KM Final.', true);
        elements.entryKmEnd.focus();
        return;
      }

      if (kmStart === null && kmEnd === null && !note) {
        showFeedback('Preencha o KM Inicial, o KM Final ou uma observação para salvar.', true);
        elements.entryKmStart.focus();
        return;
      }

      if (kmStart !== null && kmEnd !== null && kmEnd < kmStart) {
        showFeedback('O KM Final não pode ser menor que o KM Inicial.', true);
        elements.entryKmEnd.focus();
        return;
      }

      setDayRecord(state.year, state.month, state.selectedDay, kmStart, kmEnd, note);
      refreshUI(true);

      const dateStr = `${pad2(state.selectedDay)}/${pad2(state.month + 1)}`;
      if (kmStart !== null && kmEnd !== null) {
        const diff = Math.round((kmEnd - kmStart) * 10) / 10;
        showFeedback(`Dia ${dateStr} salvo com sucesso. Total rodado no dia: ${formatKm(diff)}.`);
      } else if (kmStart !== null) {
        showFeedback(`KM Inicial (${formatOdometer(kmStart)}) salvo no dia ${dateStr}. Preencha o KM Final ao encerrar o dia.`);
      } else {
        showFeedback(`Registro do dia ${dateStr} salvo com sucesso.`);
      }
    });

    // Botão Limpar Dia abre o modal de confirmação
    elements.btnClearDay.addEventListener('click', () => {
      openDeleteModal();
    });

    elements.btnCancelDelete.addEventListener('click', () => {
      closeDeleteModal();
    });

    elements.confirmModal.addEventListener('click', (e) => {
      if (e.target === elements.confirmModal) {
        closeDeleteModal();
      }
    });

    elements.btnConfirmDelete.addEventListener('click', () => {
      const dateStr = `${pad2(state.selectedDay)}/${pad2(state.month + 1)}`;
      deleteDayRecord(state.year, state.month, state.selectedDay);
      closeDeleteModal();
      refreshUI(true);
      showFeedback(`Os dados do dia ${dateStr} foram apagados.`);
    });

    elements.toggleOnlyFilled.addEventListener('change', (e) => {
      state.onlyFilled = e.target.checked;
      renderTable();
    });

    elements.btnGeneratePdf.addEventListener('click', () => {
      if (!state.driverName.trim()) {
        elements.driverName.focus();
        const proceed = window.confirm(
          'O nome do técnico ainda não foi preenchido. Deseja gerar o relatório em PDF mesmo assim?'
        );
        if (!proceed) return;
      }
      renderPrintReport();
      if (window.jspdf && window.jspdf.jsPDF) {
        try {
          generateDirectPdf();
          return;
        } catch (err) {
          console.error('Falha na exportação direta, utilizando impressão nativa:', err);
        }
      }
      window.print();
    });
  }

  function generateDirectPdf() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const daysCount = getDaysInMonth(state.year, state.month);
    const monthRecords = getMonthRecords(state.year, state.month);
    const stats = calculateMonthStats(state.year, state.month);
    const monthNumber = pad2(state.month + 1);
    const monthName = MONTHS[state.month];
    const driverName = state.driverName.trim() || 'Não informado';
    const nowDate = new Date();
    const emittedAt = nowDate.toLocaleDateString('pt-BR') + ' às ' +
      nowDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    // Cabeçalho em Azul Marinho
    doc.setTextColor(10, 25, 47);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Relatório Mensal de Quilometragem', 14, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(36, 75, 133);
    doc.text(`Período: ${monthName} de ${state.year}`, 14, 22);

    doc.setTextColor(10, 25, 47);
    doc.setFontSize(9);
    doc.text(`Técnico / Responsável: ${driverName}`, 196, 16, { align: 'right' });
    doc.setTextColor(67, 84, 110);
    doc.text(`Emissão: ${emittedAt}`, 196, 22, { align: 'right' });

    // Linha divisória
    doc.setDrawColor(10, 25, 47);
    doc.setLineWidth(0.5);
    doc.line(14, 25, 196, 25);

    // Quadro de resumo
    doc.setFillColor(246, 248, 252);
    doc.setDrawColor(180, 196, 220);
    doc.setLineWidth(0.25);
    doc.rect(14, 28, 182, 14, 'FD');

    doc.setFontSize(7.5);
    doc.setTextColor(67, 84, 110);
    doc.text('TOTAL RODADO NO MÊS', 18, 33);
    doc.text('DIAS TRABALHADOS', 82, 33);
    doc.text('MÉDIA POR DIA', 142, 33);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(10, 25, 47);
    doc.text(formatKm(stats.totalKm), 18, 39);
    doc.text(String(stats.daysRecorded), 82, 39);
    doc.text(formatKm(stats.avgKm), 142, 39);

    // Linhas da planilha com todos os dias do mês
    const tableRows = [];
    for (let d = 1; d <= daysCount; d++) {
      const rec = monthRecords[String(d)];
      const hasData = hasDayData(rec);
      tableRows.push([
        `${pad2(d)}/${monthNumber}/${state.year}`,
        getWeekdayName(state.year, state.month, d),
        hasData && rec.note ? rec.note : '—',
        hasData ? formatOdometer(rec.kmStart) : '—',
        hasData ? formatOdometer(rec.kmEnd) : '—',
        hasData ? formatKm(rec.km) : '0 km'
      ]);
    }

    doc.autoTable({
      startY: 45,
      margin: { left: 14, right: 14, bottom: 20 },
      head: [['Data', 'Dia da semana', 'Observação / Locais visitados', 'KM Inicial', 'KM Final', 'KM Rodado']],
      body: tableRows,
      foot: [['', '', '', '', 'Total no mês', formatKm(stats.totalKm)]],
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 7.8,
        cellPadding: 1.5,
        textColor: [10, 25, 47],
        lineColor: [180, 196, 220],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [10, 25, 47],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 7.8
      },
      alternateRowStyles: {
        fillColor: [246, 248, 252]
      },
      footStyles: {
        fillColor: [237, 242, 249],
        textColor: [10, 25, 47],
        fontStyle: 'bold',
        fontSize: 8.2
      },
      columnStyles: {
        0: { cellWidth: 21 },
        1: { cellWidth: 27 },
        2: { cellWidth: 69 },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 22, halign: 'right' },
        5: { cellWidth: 21, halign: 'right' }
      },
      didParseCell: function (data) {
        if (data.section === 'head' && data.column.index >= 3) {
          data.cell.styles.halign = 'right';
        }
        if (data.section === 'foot' && data.column.index >= 4) {
          data.cell.styles.halign = 'right';
        }
      }
    });

    // Rodapé com linha de assinatura
    const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 260;
    const pageHeight = doc.internal.pageSize.getHeight();
    let signY = finalY + 14;
    if (signY > pageHeight - 12) {
      doc.addPage();
      signY = 30;
    }

    doc.setDrawColor(10, 25, 47);
    doc.setLineWidth(0.3);
    doc.line(14, signY, 84, signY);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(67, 84, 110);
    doc.text(`Assinatura — ${driverName}`, 14, signY + 4.5);
    doc.text('Controle de Quilometragem', 196, signY + 4.5, { align: 'right' });

    const safeMonth = monthName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    doc.save(`relatorio-quilometragem-${safeMonth}-${state.year}.pdf`);
  }

  // Inicialização
  function init() {
    requestPersistentStorage();
    loadState();
    initSelectors();
    refreshUI(true);
    bindEvents();

    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
          console.warn('Service Worker não registrado:', err);
        });
      });
    }
  }

  init();
})();
