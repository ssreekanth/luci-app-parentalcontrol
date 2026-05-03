'use strict';
'require view';
'require rpc';
'require ui';
'require poll';

var callGetStatus = rpc.declare({ object: 'parentalcontrol', method: 'get_status', expect: {} });
var callListDevices = rpc.declare({ object: 'parentalcontrol', method: 'list_devices', expect: {} });
var callToggleGlobal = rpc.declare({ object: 'parentalcontrol', method: 'toggle_global', params: ['enabled'] });
var callToggleRule = rpc.declare({ object: 'parentalcontrol', method: 'toggle_rule', params: ['section', 'enabled'] });
var callSetOverride = rpc.declare({ object: 'parentalcontrol', method: 'set_override', params: ['section', 'minutes'] });
var callCancelOverride = rpc.declare({ object: 'parentalcontrol', method: 'cancel_override', params: ['section'] });
var callAddRule = rpc.declare({ object: 'parentalcontrol', method: 'add_rule', params: ['name', 'mac', 'schedules', 'enabled'] });
var callUpdateRule = rpc.declare({ object: 'parentalcontrol', method: 'update_rule', params: ['section', 'name', 'schedules', 'enabled'] });
var callDeleteRule = rpc.declare({ object: 'parentalcontrol', method: 'delete_rule', params: ['section'] });

var DAY_NAMES = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
var DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

var CSS = '\
.pc-header { display:flex; align-items:center; gap:12px; padding:12px 16px; border:1px solid rgba(255,255,255,0.08); border-radius:6px; margin-bottom:20px; }\
.pc-header-label { font-weight:600; font-size:15px; }\
.pc-header-status { font-size:13px; font-weight:600; }\
.pc-table { width:100%; border-collapse:collapse; margin-bottom:16px; }\
.pc-table th { text-align:left; padding:10px 12px; font-size:12px; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid rgba(255,255,255,0.1); opacity:0.6; }\
.pc-table td { padding:10px 12px; border-bottom:1px solid rgba(255,255,255,0.05); vertical-align:middle; }\
.pc-table tr:hover td { background:rgba(255,255,255,0.02); }\
.pc-mac { font-family:monospace; font-size:12px; opacity:0.5; }\
.pc-sched-line { display:block; font-size:13px; line-height:1.6; }\
.pc-badge { display:inline-block; padding:3px 10px; border-radius:12px; color:#fff; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.3px; }\
.pc-badge-blocked { background:#c62828; }\
.pc-badge-override { background:#e65100; }\
.pc-badge-inactive { background:#546e7a; }\
.pc-actions { display:flex; gap:6px; align-items:center; }\
.pc-btn { padding:4px 12px; border:1px solid rgba(255,255,255,0.15); border-radius:4px; background:rgba(255,255,255,0.06); cursor:pointer; font-size:12px; white-space:nowrap; }\
.pc-btn:hover { background:rgba(255,255,255,0.12); border-color:rgba(255,255,255,0.25); }\
.pc-btn-danger { border-color:#c62828; color:#ef5350; }\
.pc-btn-danger:hover { background:#c62828; color:#fff; }\
.pc-btn-warn { border-color:#e65100; color:#ff9800; }\
.pc-btn-warn:hover { background:#e65100; color:#fff; }\
.pc-btn-primary { border-color:#1565c0; color:#42a5f5; }\
.pc-btn-primary:hover { background:#1565c0; color:#fff; }\
.pc-btn-success { border-color:#2e7d32; color:#66bb6a; }\
.pc-btn-success:hover { background:#2e7d32; color:#fff; }\
.pc-btn-lg { padding:8px 24px; font-size:14px; }\
.pc-select { padding:4px 8px; border:1px solid rgba(255,255,255,0.15); border-radius:4px; background:rgba(255,255,255,0.06); font-size:12px; cursor:pointer; }\
.pc-checkbox { width:18px; height:18px; cursor:pointer; accent-color:#42a5f5; }\
.pc-override-cell { display:flex; flex-direction:column; gap:4px; align-items:flex-start; }\
.pc-override-info { font-size:11px; color:#ff9800; font-weight:600; }\
.pc-section-title { font-size:16px; font-weight:600; margin:20px 0 10px; }\
\
.pc-modal-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:10000; display:flex; align-items:center; justify-content:center; }\
.pc-modal { background:#1e1e2e; border:1px solid rgba(255,255,255,0.15); border-radius:8px; padding:0; width:560px; max-width:90vw; max-height:85vh; overflow-y:auto; box-shadow:0 8px 32px rgba(0,0,0,0.5); }\
.pc-modal-header { display:flex; align-items:center; justify-content:space-between; padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.08); }\
.pc-modal-title { font-size:16px; font-weight:600; }\
.pc-modal-close { background:none; border:none; font-size:22px; cursor:pointer; opacity:0.5; padding:0 4px; line-height:1; }\
.pc-modal-close:hover { opacity:1; }\
.pc-modal-body { padding:20px; }\
.pc-modal-footer { display:flex; gap:8px; justify-content:flex-end; padding:16px 20px; border-top:1px solid rgba(255,255,255,0.08); }\
\
.pc-form-row { margin-bottom:14px; }\
.pc-form-label { display:block; font-weight:600; font-size:13px; opacity:0.6; margin-bottom:5px; }\
.pc-form-input { padding:6px 10px; border:1px solid rgba(255,255,255,0.15); border-radius:4px; background:rgba(255,255,255,0.06); font-size:13px; width:100%; box-sizing:border-box; }\
.pc-form-input-inline { width:auto; }\
.pc-device-row { display:flex; gap:10px; align-items:center; }\
.pc-device-row select { flex:1; }\
.pc-device-row input { width:160px; }\
\
.pc-sched-block { padding:12px; border:1px solid rgba(255,255,255,0.08); border-radius:4px; margin-bottom:8px; }\
.pc-sched-block-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }\
.pc-sched-block-title { font-size:12px; font-weight:600; opacity:0.4; text-transform:uppercase; letter-spacing:0.5px; }\
.pc-sched-block-remove { font-size:12px; color:#ef5350; cursor:pointer; background:none; border:none; padding:0; opacity:0.7; }\
.pc-sched-block-remove:hover { opacity:1; }\
.pc-day-checks { display:flex; gap:4px; flex-wrap:wrap; }\
.pc-day-btn { padding:4px 8px; border:1px solid rgba(255,255,255,0.15); border-radius:3px; background:rgba(255,255,255,0.04); cursor:pointer; font-size:12px; user-select:none; transition:all 0.15s; }\
.pc-day-btn.active { background:#1565c0; border-color:#1565c0; color:#fff; }\
.pc-day-btn:hover { border-color:rgba(255,255,255,0.3); }\
.pc-time-row { display:flex; align-items:center; gap:8px; margin-top:8px; }\
.pc-time-label { font-size:12px; opacity:0.5; font-weight:600; }\
.pc-time-input { width:120px; }\
';

function formatDuration(seconds) {
	if (seconds <= 0) return '';
	var h = Math.floor(seconds / 3600);
	var m = Math.floor((seconds % 3600) / 60);
	if (h > 0) return h + 'h ' + m + 'm';
	return m + 'm';
}

function compactDays(dayList) {
	var order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
	var labels = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
	var sorted = dayList.slice().sort(function(a, b) { return order.indexOf(a) - order.indexOf(b); });
	if (sorted.length === 7) return 'Every day';
	if (sorted.length === 5 && sorted.join(',') === 'mon,tue,wed,thu,fri') return 'Mon-Fri';
	if (sorted.length === 2 && sorted.join(',') === 'sat,sun') return 'Sat-Sun';
	var ranges = [], i = 0;
	while (i < sorted.length) {
		var start = i;
		while (i + 1 < sorted.length && order.indexOf(sorted[i + 1]) === order.indexOf(sorted[i]) + 1) i++;
		if (i - start >= 2) ranges.push(labels[sorted[start]] + '-' + labels[sorted[i]]);
		else for (var j = start; j <= i; j++) ranges.push(labels[sorted[j]]);
		i++;
	}
	return ranges.join(', ');
}

function formatScheduleLines(scheduleStr) {
	if (!scheduleStr) return ['-'];
	return scheduleStr.split('|').map(function(s) {
		var parts = s.trim().split(' ');
		if (parts.length < 2) return s;
		return compactDays(parts[0].split(',')) + ' ' + parts[1];
	});
}

function statusBadge(status, overrideRemaining) {
	var cls, text;
	switch (status) {
		case 'active': cls = 'pc-badge pc-badge-blocked'; text = 'Blocked'; break;
		case 'override': cls = 'pc-badge pc-badge-override'; text = 'Paused (' + formatDuration(overrideRemaining) + ')'; break;
		default: cls = 'pc-badge pc-badge-inactive'; text = 'Inactive';
	}
	return E('span', { 'class': cls }, text);
}

function parseSchedules(scheduleStr) {
	if (!scheduleStr) return [];
	return scheduleStr.split('|').map(function(s) {
		var parts = s.trim().split(' ');
		var days = parts[0] ? parts[0].split(',') : [];
		var times = parts[1] ? parts[1].split('-') : ['22:00', '07:00'];
		return { days: days, start: times[0], end: times[1] || '07:00' };
	});
}

// --- Schedule block rendering ---

function renderScheduleBlock(prefix, idx, sched, showRemove) {
	var block = E('div', { 'class': 'pc-sched-block', 'data-sched-idx': idx });

	var header = E('div', { 'class': 'pc-sched-block-header' });
	header.appendChild(E('span', { 'class': 'pc-sched-block-title' }, 'Schedule ' + (idx + 1)));
	if (showRemove) {
		header.appendChild(E('button', {
			'class': 'pc-sched-block-remove',
			'click': function() {
				var container = block.parentNode;
				block.remove();
				renumberBlocks(container, prefix);
			}
		}, 'Remove'));
	}
	block.appendChild(header);

	var dayRow = E('div', { 'class': 'pc-day-checks' });
	DAY_NAMES.forEach(function(d, i) {
		var active = sched.days.indexOf(d) >= 0;
		var btn = E('span', {
			'class': 'pc-day-btn' + (active ? ' active' : ''),
			'data-day': d,
			'click': function() {
				btn.classList.toggle('active');
				hiddenInput.value = btn.classList.contains('active') ? '1' : '';
			}
		}, DAY_LABELS[i]);
		var hiddenInput = E('input', {
			'type': 'hidden',
			'name': prefix + '_day_' + idx + '_' + d,
			'value': active ? '1' : ''
		});
		dayRow.appendChild(btn);
		dayRow.appendChild(hiddenInput);
	});
	block.appendChild(dayRow);

	block.appendChild(E('div', { 'class': 'pc-time-row' }, [
		E('span', { 'class': 'pc-time-label' }, 'From'),
		E('input', { 'type': 'time', 'name': prefix + '_start_' + idx, 'value': sched.start, 'class': 'pc-form-input pc-form-input-inline pc-time-input' }),
		E('span', { 'class': 'pc-time-label' }, 'to'),
		E('input', { 'type': 'time', 'name': prefix + '_end_' + idx, 'value': sched.end, 'class': 'pc-form-input pc-form-input-inline pc-time-input' })
	]));

	return block;
}

function renumberBlocks(container, prefix) {
	var blocks = container.querySelectorAll('.pc-sched-block');
	blocks.forEach(function(block, newIdx) {
		block.setAttribute('data-sched-idx', newIdx);
		var title = block.querySelector('.pc-sched-block-title');
		if (title) title.textContent = 'Schedule ' + (newIdx + 1);

		DAY_NAMES.forEach(function(d) {
			var inp = block.querySelector('[name*="_day_"][name$="_' + d + '"]');
			if (inp) inp.name = prefix + '_day_' + newIdx + '_' + d;
		});
		var s = block.querySelector('[name*="_start_"]');
		if (s) s.name = prefix + '_start_' + newIdx;
		var e = block.querySelector('[name*="_end_"]');
		if (e) e.name = prefix + '_end_' + newIdx;

		var removeBtn = block.querySelector('.pc-sched-block-remove');
		if (removeBtn) removeBtn.style.display = blocks.length <= 1 ? 'none' : '';
	});
}

function renderScheduleEditor(prefix, schedules) {
	if (!schedules || schedules.length === 0)
		schedules = [{ days: ['mon', 'tue', 'wed', 'thu', 'fri'], start: '22:00', end: '07:00' }];

	var wrapper = E('div');
	var blocksDiv = E('div', { 'class': 'pc-sched-blocks' });

	schedules.forEach(function(sched, idx) {
		blocksDiv.appendChild(renderScheduleBlock(prefix, idx, sched, schedules.length > 1));
	});
	wrapper.appendChild(blocksDiv);

	wrapper.appendChild(E('button', {
		'class': 'pc-btn pc-btn-primary',
		'style': 'margin-top:4px;',
		'click': function(ev) {
			ev.preventDefault();
			var count = blocksDiv.querySelectorAll('.pc-sched-block').length;
			blocksDiv.appendChild(renderScheduleBlock(prefix, count,
				{ days: ['sat', 'sun'], start: '22:00', end: '08:00' }, true));
			renumberBlocks(blocksDiv, prefix);
		}
	}, '+ Add Schedule'));

	return wrapper;
}

function collectSchedules(container, prefix) {
	var schedules = [], idx = 0;
	while (true) {
		var startInput = container.querySelector('[name="' + prefix + '_start_' + idx + '"]');
		if (!startInput) break;
		var endInput = container.querySelector('[name="' + prefix + '_end_' + idx + '"]');
		var days = [];
		DAY_NAMES.forEach(function(d) {
			var inp = container.querySelector('[name="' + prefix + '_day_' + idx + '_' + d + '"]');
			if (inp && inp.value === '1') days.push(d);
		});
		if (days.length > 0 && startInput.value && endInput.value)
			schedules.push(days.join(',') + ' ' + startInput.value + '-' + endInput.value);
		idx++;
	}
	return schedules.join('|');
}

// --- Modal ---

function showModal(title, contentFn, footerFn) {
	var overlay = E('div', { 'class': 'pc-modal-overlay' });
	var modal = E('div', { 'class': 'pc-modal' });

	var closeModal = function() { overlay.remove(); };

	overlay.addEventListener('click', function(ev) {
		if (ev.target === overlay) closeModal();
	});

	var header = E('div', { 'class': 'pc-modal-header' }, [
		E('span', { 'class': 'pc-modal-title' }, title),
		E('button', { 'class': 'pc-modal-close', 'click': closeModal }, '×')
	]);
	modal.appendChild(header);

	var body = E('div', { 'class': 'pc-modal-body' });
	contentFn(body);
	modal.appendChild(body);

	var footer = E('div', { 'class': 'pc-modal-footer' });
	footerFn(footer, body, closeModal);
	modal.appendChild(footer);

	overlay.appendChild(modal);
	document.body.appendChild(overlay);
	return { overlay: overlay, close: closeModal };
}

// --- Cached devices for modal ---
var _cachedDevices = [];

return view.extend({
	load: function() {
		return Promise.all([callGetStatus(), callListDevices()]);
	},

	render: function(data) {
		var status = data[0] || {};
		var deviceData = data[1] || {};
		var rules = status.rules || [];
		var devices = deviceData.devices || [];
		var globalEnabled = status.global_enabled;

		_cachedDevices = devices.slice().sort(function(a, b) {
			var aName = a.hostname || '', bName = b.hostname || '';
			if (aName && !bName) return -1;
			if (!aName && bName) return 1;
			return aName.localeCompare(bName);
		});

		var viewEl = E('div', { 'class': 'cbi-map' });
		viewEl.appendChild(E('style', {}, CSS));
		viewEl.appendChild(E('h2', {}, 'Parental Control'));

		// Global toggle
		var globalSection = E('div', { 'class': 'pc-header' });
		globalSection.appendChild(E('span', { 'class': 'pc-header-label' }, 'Parental Control:'));
		globalSection.appendChild(E('button', {
			'class': globalEnabled ? 'pc-btn pc-btn-danger' : 'pc-btn pc-btn-success',
			'click': function() {
				callToggleGlobal(globalEnabled ? 0 : 1).then(function() { window.location.reload(); });
			}
		}, globalEnabled ? 'Disable' : 'Enable'));
		globalSection.appendChild(E('span', {
			'class': 'pc-header-status',
			'style': 'color:' + (globalEnabled ? '#66bb6a' : '#888')
		}, globalEnabled ? 'Active' : 'Disabled'));
		viewEl.appendChild(globalSection);

		// Rules table
		var titleRow = E('div', { 'style': 'display:flex; align-items:center; justify-content:space-between; margin:20px 0 10px;' });
		titleRow.appendChild(E('div', { 'class': 'pc-section-title', 'style': 'margin:0;' }, 'Controlled Devices'));
		titleRow.appendChild(E('button', {
			'class': 'pc-btn pc-btn-success',
			'click': function() { openAddModal(); }
		}, '+ Add Rule'));
		viewEl.appendChild(titleRow);

		if (rules.length === 0) {
			viewEl.appendChild(E('p', { 'style': 'opacity:0.5;padding:8px 0;' }, 'No parental control rules configured.'));
		} else {
			var table = E('table', { 'class': 'pc-table' });
			table.appendChild(E('tr', {}, [
				E('th', {}, 'Device'),
				E('th', {}, 'Schedule'),
				E('th', {}, 'Status'),
				E('th', { 'style': 'text-align:center;width:60px;' }, 'Enabled'),
				E('th', { 'style': 'width:150px;' }, 'Override'),
				E('th', { 'style': 'width:120px;' }, 'Actions')
			]));

			rules.forEach(function(rule) {
				var row = E('tr', {});

				row.appendChild(E('td', {}, [
					E('div', { 'style': 'font-weight:600;' }, rule.name || '-'),
					E('div', { 'class': 'pc-mac' }, rule.mac || '')
				]));

				// Schedule: each schedule on its own line
				var schedCell = E('td', {});
				formatScheduleLines(rule.schedules).forEach(function(line) {
					schedCell.appendChild(E('span', { 'class': 'pc-sched-line' }, line));
				});
				row.appendChild(schedCell);

				row.appendChild(E('td', {}, [statusBadge(rule.status, rule.override_remaining)]));

				var enableCell = E('td', { 'style': 'text-align:center;' });
				enableCell.appendChild(E('input', {
					'type': 'checkbox', 'class': 'pc-checkbox',
					'checked': rule.enabled ? '' : null,
					'change': (function(r) {
						return function(ev) {
							callToggleRule(r.section, ev.target.checked ? 1 : 0).then(function() { window.location.reload(); });
						};
					})(rule)
				}));
				row.appendChild(enableCell);

				var overrideCell = E('td', {});
				var oc = E('div', { 'class': 'pc-override-cell' });
				if (rule.enabled && rule.status === 'active') {
					oc.appendChild(E('select', {
						'class': 'pc-select',
						'change': (function(r) {
							return function(ev) {
								var m = parseInt(ev.target.value);
								if (m > 0) callSetOverride(r.section, m).then(function() { window.location.reload(); });
							};
						})(rule)
					}, [
						E('option', { 'value': '0' }, 'Pause...'),
						E('option', { 'value': '30' }, '30 min'),
						E('option', { 'value': '60' }, '1 hour'),
						E('option', { 'value': '120' }, '2 hours')
					]));
				} else if (rule.status === 'override') {
					oc.appendChild(E('span', { 'class': 'pc-override-info' }, 'Paused ' + formatDuration(rule.override_remaining)));
					oc.appendChild(E('button', {
						'class': 'pc-btn pc-btn-warn', 'style': 'padding:2px 8px;font-size:11px;',
						'click': (function(r) {
							return function() { callCancelOverride(r.section).then(function() { window.location.reload(); }); };
						})(rule)
					}, 'Resume'));
				} else {
					oc.appendChild(E('span', { 'style': 'opacity:0.3;font-size:12px;' }, '—'));
				}
				overrideCell.appendChild(oc);
				row.appendChild(overrideCell);

				var actions = E('td', {});
				var ar = E('div', { 'class': 'pc-actions' });
				ar.appendChild(E('button', {
					'class': 'pc-btn pc-btn-primary',
					'click': (function(r) { return function() { openEditModal(r); }; })(rule)
				}, 'Edit'));
				ar.appendChild(E('button', {
					'class': 'pc-btn pc-btn-danger',
					'click': (function(r) {
						return function() {
							if (confirm('Delete rule "' + (r.name || r.mac) + '"?'))
								callDeleteRule(r.section).then(function() { window.location.reload(); });
						};
					})(rule)
				}, 'Delete'));
				actions.appendChild(ar);
				row.appendChild(actions);
				table.appendChild(row);
			});

			viewEl.appendChild(table);
		}

		// Auto-refresh
		poll.add(function() {
			callGetStatus().then(function(ns) {
				var cells = document.querySelectorAll('.pc-table td:nth-child(3)');
				(ns.rules || []).forEach(function(r, i) {
					if (cells[i]) { cells[i].innerHTML = ''; cells[i].appendChild(statusBadge(r.status, r.override_remaining)); }
				});
			});
		}, 30);

		return viewEl;
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});

function openAddModal() {
	showModal('Add New Rule', function(body) {
		body.appendChild(E('div', { 'class': 'pc-form-row' }, [
			E('span', { 'class': 'pc-form-label' }, 'Device Name'),
			E('input', { 'type': 'text', 'name': 'rule_name', 'placeholder': 'e.g. Kids iPad', 'class': 'pc-form-input' })
		]));

		var devRow = E('div', { 'class': 'pc-form-row' });
		devRow.appendChild(E('span', { 'class': 'pc-form-label' }, 'Device'));
		var deviceDiv = E('div', { 'class': 'pc-device-row' });
		var macSelect = E('select', { 'name': 'rule_mac', 'class': 'pc-form-input pc-form-input-inline' });
		macSelect.appendChild(E('option', { 'value': '' }, '-- Select a device --'));
		_cachedDevices.forEach(function(dev) {
			var label = dev.mac;
			if (dev.hostname && dev.hostname !== 'unknown' && dev.hostname !== '') label = dev.hostname + ' (' + dev.mac + ')';
			if (dev.ip) label += ' - ' + dev.ip;
			macSelect.appendChild(E('option', { 'value': dev.mac }, label));
		});
		deviceDiv.appendChild(macSelect);
		deviceDiv.appendChild(E('span', { 'style': 'opacity:0.4;font-size:12px;' }, 'or'));
		deviceDiv.appendChild(E('input', { 'type': 'text', 'name': 'rule_mac_manual', 'placeholder': 'AA:BB:CC:DD:EE:FF', 'class': 'pc-form-input pc-form-input-inline', 'style': 'width:160px;' }));
		devRow.appendChild(deviceDiv);
		body.appendChild(devRow);

		body.appendChild(E('div', { 'class': 'pc-form-row' }, [
			E('span', { 'class': 'pc-form-label' }, 'Block Schedule'),
			renderScheduleEditor('add', null)
		]));
	}, function(footer, body, closeModal) {
		footer.appendChild(E('button', { 'class': 'pc-btn', 'click': closeModal }, 'Cancel'));
		footer.appendChild(E('button', {
			'class': 'pc-btn pc-btn-success pc-btn-lg',
			'click': function() {
				var name = body.querySelector('[name="rule_name"]').value.trim();
				var mac = body.querySelector('[name="rule_mac"]').value;
				var macManual = body.querySelector('[name="rule_mac_manual"]').value.trim();
				if (macManual) mac = macManual;
				if (!name) { ui.addNotification(null, E('p', 'Please enter a device name.'), 'warning'); return; }
				if (!mac) { ui.addNotification(null, E('p', 'Please select or enter a MAC address.'), 'warning'); return; }
				var schedules = collectSchedules(body, 'add');
				if (!schedules) { ui.addNotification(null, E('p', 'Please configure at least one schedule.'), 'warning'); return; }
				callAddRule(name, mac, schedules, 1).then(function() { window.location.reload(); });
			}
		}, 'Add Rule'));
	});
}

function openEditModal(rule) {
	showModal('Edit Rule — ' + (rule.name || rule.mac), function(body) {
		body.appendChild(E('div', { 'class': 'pc-form-row' }, [
			E('span', { 'class': 'pc-form-label' }, 'Device Name'),
			E('input', { 'type': 'text', 'name': 'edit_name', 'value': rule.name || '', 'class': 'pc-form-input' })
		]));

		body.appendChild(E('div', { 'class': 'pc-form-row' }, [
			E('span', { 'class': 'pc-form-label' }, 'MAC Address'),
			E('input', { 'type': 'text', 'value': rule.mac || '', 'class': 'pc-form-input', 'disabled': '', 'style': 'opacity:0.5;' })
		]));

		body.appendChild(E('div', { 'class': 'pc-form-row' }, [
			E('span', { 'class': 'pc-form-label' }, 'Block Schedule'),
			renderScheduleEditor('edit', parseSchedules(rule.schedules))
		]));
	}, function(footer, body, closeModal) {
		footer.appendChild(E('button', { 'class': 'pc-btn', 'click': closeModal }, 'Cancel'));
		footer.appendChild(E('button', {
			'class': 'pc-btn pc-btn-success pc-btn-lg',
			'click': function() {
				var name = body.querySelector('[name="edit_name"]').value.trim();
				if (!name) { ui.addNotification(null, E('p', 'Please enter a device name.'), 'warning'); return; }
				var schedules = collectSchedules(body, 'edit');
				if (!schedules) { ui.addNotification(null, E('p', 'Please configure at least one schedule.'), 'warning'); return; }
				callUpdateRule(rule.section, name, schedules, rule.enabled ? 1 : 0).then(function() { window.location.reload(); });
			}
		}, 'Save Changes'));
	});
}
