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
    mode: 'add', // 'add' (Somar ao dia) ou 'replace' (Substituir dia inteiro)
    onlyFilled: false,
    records: {} // Formato: "YYYY-MM": { "1": { km: 10.5, note: "Centro" } }
  };

  // Elementos do DOM
  const elements = {
    storageStatus: document.getElementById('storageStatus'),
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
    currentDayBox: document.getElementById('currentDayBox'),
    currentDayLabel: document.getElementById('currentDayLabel'),
    currentDayKmValue: document.getElementById('currentDayKmValue'),
    currentDayNoteValue: document.getElementById('currentDayNoteValue'),
    modeAddBtn: document.getElementById('modeAddBtn'),
    modeReplaceBtn: document.getElementById('modeReplaceBtn'),
    modeHintText: document.getElementById('modeHintText'),
    labelEntryKm: document.getElementById('labelEntryKm'),
    entryKm: document.getElementById('entryKm'),
    labelEntryNote: document.getElementById('labelEntryNote'),
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
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }) + ' km';
  }

  function formatNumberInput(value) {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return '';
    return num.toLocaleString('pt-BR', {
      minimumFractionDigits: Number.isInteger(num) ? 0 : 1,
      maximumFractionDigits: 2
    });
  }

  function parseKmInput(raw) {
    if (typeof raw !== 'string') return NaN;
    const cleaned = raw.trim().replace(/\s+/g, '');
    if (!cleaned) return NaN;
    let normalized = cleaned;
    if (cleaned.includes(',') && cleaned.includes('.')) {
      normalized = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
      normalized = cleaned.replace(',', '.');
    }
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed < 0) return NaN;
    return Math.round(parsed * 100) / 100;
  }

  // Junta observações sem duplicar locais já informados
  function mergeNotes(existingNote, newNote) {
    const parts = [];
    const seen = new Set();

    function addSegments(text) {
      if (!text) return;
      text.split(';').forEach((segment) => {
        const clean = segment.trim();
        if (!clean) return;
        const lower = clean.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          parts.push(clean);
        }
      });
    }

    addSegments(existingNote);
    addSegments(newNote);
    return parts.join('; ');
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
      if (elements.storageStatus) {
        const timeStr = new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit'
        });
        elements.storageStatus.textContent = `Salvo neste dispositivo (${timeStr})`;
      }
    } catch (err) {
      console.error('Erro ao salvar dados no dispositivo:', err);
      if (elements.storageStatus) {
        elements.storageStatus.textContent = 'Atenção: armazenamento local indisponível';
      }
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

  function setDayRecord(year, month, day, km, note) {
    const key = getPeriodKey(year, month);
    if (!state.records[key]) {
      state.records[key] = {};
    }
    const cleanNote = (note || '').trim();
    const numericKm = Number(km) || 0;

    if (numericKm <= 0 && !cleanNote) {
      delete state.records[key][String(day)];
    } else {
      state.records[key][String(day)] = {
        km: numericKm,
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
      const hasRecord = Boolean(rec && (rec.km > 0 || (rec.note && rec.note.trim())));
      const opt = document.createElement('option');
      opt.value = String(d);
      opt.textContent = `${pad2(d)}/${pad2(state.month + 1)} (${weekdayShort})${hasRecord ? ' • Salvo' : ''}`;
      elements.entryDay.appendChild(opt);
    }

    elements.entryDay.value = String(state.selectedDay);
    elements.btnPrevDay.disabled = state.selectedDay <= 1;
    elements.btnNextDay.disabled = state.selectedDay >= daysCount;
  }

  // Atualiza o painel que mostra o acumulado do dia e ajusta os campos conforme o modo
  function updateDayPanelAndInputs(resetInputs = true) {
    const record = getDayRecord(state.year, state.month, state.selectedDay);
    const hasRecord = Boolean(record && (record.km > 0 || (record.note && record.note.trim())));
    const dateFormatted = `${pad2(state.selectedDay)}/${pad2(state.month + 1)}/${state.year}`;

    elements.currentDayLabel.textContent = `Acumulado no dia ${dateFormatted}`;
    elements.currentDayKmValue.textContent = hasRecord ? formatKm(record.km) : '0,0 km';
    elements.currentDayNoteValue.textContent = hasRecord && record.note
      ? `Locais registrados: ${record.note}`
      : 'Nenhum deslocamento registrado neste dia até o momento.';

    // Atualiza estado visual dos botões de modo
    const isAddMode = state.mode === 'add';
    elements.modeAddBtn.classList.toggle('active', isAddMode);
    elements.modeReplaceBtn.classList.toggle('active', !isAddMode);

    if (isAddMode) {
      elements.modeHintText.textContent =
        'Soma a quilometragem digitada ao dia e adiciona a nova observação sem repetir a anterior.';
      elements.labelEntryKm.textContent = 'Quilometragem a somar (km)';
      elements.labelEntryNote.textContent = 'Nova observação (digite apenas o novo local)';
      elements.entryNote.placeholder = 'Ex: Bairro Maracanã';
      elements.btnSubmitEntry.textContent = hasRecord
        ? `Somar ao dia ${pad2(state.selectedDay)}/${pad2(state.month + 1)}`
        : `Salvar no dia ${pad2(state.selectedDay)}/${pad2(state.month + 1)}`;

      // No modo Somar, os campos de entrada e observação ficam sempre limpos para evitar duplicação
      if (resetInputs) {
        elements.entryKm.value = '';
        elements.entryNote.value = '';
      }
    } else {
      elements.modeHintText.textContent =
        'Substitui o valor total de quilometragem e a observação inteira deste dia.';
      elements.labelEntryKm.textContent = 'Quilometragem total do dia (km)';
      elements.labelEntryNote.textContent = 'Observação completa do dia';
      elements.entryNote.placeholder = 'Descreva todos os locais visitados no dia';
      elements.btnSubmitEntry.textContent = `Salvar substituição do dia ${pad2(state.selectedDay)}/${pad2(state.month + 1)}`;

      if (resetInputs) {
        elements.entryKm.value = hasRecord ? formatNumberInput(record.km) : '';
        elements.entryNote.value = hasRecord && record.note ? record.note : '';
      }
    }
  }

  function calculateMonthStats(year, month) {
    const daysCount = getDaysInMonth(year, month);
    const monthRecords = getMonthRecords(year, month);

    let totalKm = 0;
    let daysRecorded = 0;

    for (let d = 1; d <= daysCount; d++) {
      const rec = monthRecords[String(d)];
      if (rec && (rec.km > 0 || (rec.note && rec.note.trim().length > 0))) {
        const kmVal = Number(rec.km) || 0;
        totalKm += kmVal;
        if (kmVal > 0) {
          daysRecorded += 1;
        }
      }
    }

    const avgKm = daysRecorded > 0 ? totalKm / daysRecorded : 0;
    return {
      totalKm: Math.round(totalKm * 100) / 100,
      daysRecorded,
      avgKm: Math.round(avgKm * 100) / 100
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

  function renderTable() {
    const daysCount = getDaysInMonth(state.year, state.month);
    const monthRecords = getMonthRecords(state.year, state.month);
    const monthNumber = pad2(state.month + 1);

    elements.sheetBody.innerHTML = '';
    let renderedRows = 0;

    for (let d = 1; d <= daysCount; d++) {
      const rec = monthRecords[String(d)];
      const hasData = Boolean(rec && (rec.km > 0 || (rec.note && rec.note.trim())));

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
      tdNote.textContent = hasData && rec.note ? rec.note : '—';

      const tdKm = document.createElement('td');
      tdKm.className = 'col-km';
      tdKm.textContent = hasData ? formatKm(rec.km) : '0,0 km';

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
      const hasData = Boolean(rec && (rec.km > 0 || (rec.note && rec.note.trim())));

      const tr = document.createElement('tr');

      const tdDate = document.createElement('td');
      tdDate.textContent = `${pad2(d)}/${monthNumber}/${state.year}`;

      const tdWeekday = document.createElement('td');
      tdWeekday.textContent = getWeekdayName(state.year, state.month, d);

      const tdNote = document.createElement('td');
      tdNote.textContent = hasData && rec.note ? rec.note : '—';

      const tdKm = document.createElement('td');
      tdKm.style.textAlign = 'right';
      tdKm.style.fontWeight = hasData && rec.km > 0 ? '600' : '400';
      tdKm.textContent = hasData ? formatKm(rec.km) : '0,0 km';

      tr.appendChild(tdDate);
      tr.appendChild(tdWeekday);
      tr.appendChild(tdNote);
      tr.appendChild(tdKm);

      elements.printTableBody.appendChild(tr);
    }
  }

  function refreshUI(resetInputs = true) {
    populateDaySelect();
    updateDayPanelAndInputs(resetInputs);
    renderSummary();
    renderTable();
    renderPrintReport();
  }

  function selectDay(day, scrollToForm) {
    state.selectedDay = Number(day);
    state.mode = 'add'; // Volta sempre ao modo seguro de somar, limpando os campos
    refreshUI(true);
    if (scrollToForm && elements.formCard) {
      elements.formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // Modal de confirmação para limpar o dia
  function openDeleteModal() {
    const record = getDayRecord(state.year, state.month, state.selectedDay);
    const hasRecord = Boolean(record && (record.km > 0 || (record.note && record.note.trim())));
    const dateStr = `${pad2(state.selectedDay)}/${pad2(state.month + 1)}/${state.year}`;

    if (!hasRecord) {
      elements.entryKm.value = '';
      elements.entryNote.value = '';
      showFeedback(`O dia ${dateStr} já está sem registros salvos.`);
      return;
    }

    elements.modalMessage.textContent =
      `Tem certeza de que deseja apagar todos os dados registrados no dia ${dateStr}?`;
    elements.modalPreview.innerHTML =
      `<strong>Quilometragem:</strong> ${formatKm(record.km)}<br>` +
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
      state.mode = 'add';
      refreshUI(true);
    });

    elements.selectYear.addEventListener('input', (e) => {
      const y = parseInt(e.target.value, 10);
      if (Number.isFinite(y) && y >= 2000 && y <= 2100) {
        state.year = y;
        state.mode = 'add';
        refreshUI(true);
      }
    });

    elements.selectYear.addEventListener('change', (e) => {
      let y = parseInt(e.target.value, 10);
      if (!Number.isFinite(y) || y < 2000) y = 2000;
      if (y > 2100) y = 2100;
      state.year = y;
      elements.selectYear.value = String(y);
      state.mode = 'add';
      refreshUI(true);
    });

    elements.btnGoToday.addEventListener('click', () => {
      const today = new Date();
      state.year = today.getFullYear();
      state.month = today.getMonth();
      state.selectedDay = today.getDate();
      state.mode = 'add';
      elements.selectMonth.value = String(state.month);
      elements.selectYear.value = String(state.year);
      refreshUI(true);
      showFeedback(`Selecionado o dia de hoje (${pad2(state.selectedDay)}/${pad2(state.month + 1)}/${state.year}).`);
    });

    elements.entryDay.addEventListener('change', (e) => {
      state.selectedDay = Number(e.target.value);
      state.mode = 'add';
      refreshUI(true);
    });

    elements.btnPrevDay.addEventListener('click', () => {
      if (state.selectedDay > 1) {
        state.selectedDay -= 1;
        state.mode = 'add';
        refreshUI(true);
      }
    });

    elements.btnNextDay.addEventListener('click', () => {
      const daysCount = getDaysInMonth(state.year, state.month);
      if (state.selectedDay < daysCount) {
        state.selectedDay += 1;
        state.mode = 'add';
        refreshUI(true);
      }
    });

    // Alternância entre Somar ao dia e Substituir dia inteiro
    elements.modeAddBtn.addEventListener('click', () => {
      if (state.mode !== 'add') {
        state.mode = 'add';
        // Ao mudar para Somar, apaga a observação e o km dos campos de digitação
        updateDayPanelAndInputs(true);
      }
    });

    elements.modeReplaceBtn.addEventListener('click', () => {
      if (state.mode !== 'replace') {
        state.mode = 'replace';
        updateDayPanelAndInputs(true);
      }
    });

    // Salvamento do formulário
    elements.entryForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const rawKm = elements.entryKm.value;
      const note = elements.entryNote.value.trim();

      let parsedKm = 0;
      if (rawKm.trim() !== '') {
        parsedKm = parseKmInput(rawKm);
        if (Number.isNaN(parsedKm)) {
          showFeedback('Informe um valor numérico válido para a quilometragem.', true);
          elements.entryKm.focus();
          return;
        }
      } else if (!note) {
        showFeedback('Informe a quilometragem ou uma observação para salvar no dia.', true);
        elements.entryKm.focus();
        return;
      }

      const existing = getDayRecord(state.year, state.month, state.selectedDay);

      let finalKm = parsedKm;
      let finalNote = note;

      if (state.mode === 'add' && existing) {
        finalKm = Math.round(((Number(existing.km) || 0) + parsedKm) * 100) / 100;
        finalNote = mergeNotes(existing.note, note);
      } else if (state.mode === 'replace') {
        finalNote = mergeNotes('', note);
      }

      setDayRecord(state.year, state.month, state.selectedDay, finalKm, finalNote);

      // Após salvar, mantém em modo Somar e limpa a observação e o km digitados
      state.mode = 'add';
      refreshUI(true);

      const dateStr = `${pad2(state.selectedDay)}/${pad2(state.month + 1)}`;
      showFeedback(`Registro salvo no dia ${dateStr}. Total do dia: ${formatKm(finalKm)}.`);
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
      state.mode = 'add';
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
          'O seu nome ainda não foi preenchido. Deseja gerar o relatório em PDF mesmo assim?'
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
    doc.text(`Responsável: ${driverName}`, 196, 16, { align: 'right' });
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
    doc.text('TOTAL NO MÊS', 18, 33);
    doc.text('DIAS REGISTRADOS', 82, 33);
    doc.text('MÉDIA POR DIA RODADO', 142, 33);

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
      const hasData = Boolean(rec && (rec.km > 0 || (rec.note && rec.note.trim())));
      tableRows.push([
        `${pad2(d)}/${monthNumber}/${state.year}`,
        getWeekdayName(state.year, state.month, d),
        hasData && rec.note ? rec.note : '—',
        hasData ? formatKm(rec.km) : '0,0 km'
      ]);
    }

    doc.autoTable({
      startY: 45,
      margin: { left: 14, right: 14, bottom: 20 },
      head: [['Dia do mês', 'Dia da semana', 'Observação / Locais visitados', 'Quilometragem']],
      body: tableRows,
      foot: [['', '', 'Total acumulado no mês', formatKm(stats.totalKm)]],
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 1.6,
        textColor: [10, 25, 47],
        lineColor: [180, 196, 220],
        lineWidth: 0.2
      },
      headStyles: {
        fillColor: [10, 25, 47],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8
      },
      alternateRowStyles: {
        fillColor: [246, 248, 252]
      },
      footStyles: {
        fillColor: [237, 242, 249],
        textColor: [10, 25, 47],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 32 },
        2: { cellWidth: 95 },
        3: { cellWidth: 30, halign: 'right' }
      },
      didParseCell: function (data) {
        if (data.section === 'foot' && data.column.index === 2) {
          data.cell.styles.halign = 'right';
        }
        if (data.section === 'foot' && data.column.index === 3) {
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
