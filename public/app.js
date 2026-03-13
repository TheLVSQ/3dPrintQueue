const queueEl = document.getElementById('queue');
const form = document.getElementById('order-form');
const chips = document.querySelectorAll('.status-filter .chip');
const refreshBtn = document.getElementById('refresh-btn');
const autoRefreshToggle = document.getElementById('auto-refresh');
const template = document.getElementById('order-card-template');
const toggleFormBtn = document.getElementById('toggle-form');
const formBody = document.getElementById('order-form-body');

let currentFilter = 'pending';
let autoRefreshTimer = null;

toggleFormBtn.addEventListener('click', () => {
  const collapsed = formBody.classList.toggle('collapsed');
  toggleFormBtn.textContent = collapsed ? '+ Add' : '− Hide';
  toggleFormBtn.setAttribute('aria-expanded', String(!collapsed));
});

const formatShipDate = (iso) => {
  if (!iso) {
    return 'No ship date';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return 'Ship TBD';
  }
  return `Ship by ${date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })}`;
};

const renderEmpty = () => {
  queueEl.innerHTML = '';
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.innerHTML = '<p>No jobs yet. Add one or let n8n send them here.</p>';
  queueEl.appendChild(empty);
};

const fetchOrders = async () => {
  const url = currentFilter === 'all' ? '/api/orders' : `/api/orders?status=${currentFilter}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error('Failed to load orders');
  }
  return res.json();
};

const fetchCounts = async () => {
  const res = await fetch('/api/orders/counts');
  if (!res.ok) return null;
  return res.json();
};

const updateChipCounts = (counts) => {
  if (!counts) return;
  for (const [key, val] of Object.entries(counts)) {
    const el = document.getElementById(`count-${key}`);
    if (el) el.textContent = val > 0 ? val : '';
  }
};

const updateQueue = async () => {
  queueEl.dataset.loading = 'true';
  try {
    const [orders, counts] = await Promise.all([fetchOrders(), fetchCounts()]);
    updateChipCounts(counts);

    if (!orders.length) {
      renderEmpty();
      return;
    }

    queueEl.innerHTML = '';
    orders.forEach((order) => {
      const node = template.content.firstElementChild.cloneNode(true);
      node.dataset.status = order.status;
      node.querySelector('.order-number').textContent = `Order #${order.orderNumber}`;
      node.querySelector('.order-item').textContent = order.itemName;
      node.querySelector('.order-filament').textContent = `${order.filamentType} / ${order.filamentColor}`;
      node.querySelector('.order-ship').textContent = formatShipDate(order.shipBy);
      node.querySelector('.order-notes').textContent = order.notes || 'No notes';
      node.querySelector('.quantity').textContent = `${order.quantity} pcs`;

      const completeBtn = node.querySelector('.complete-btn');
      const cancelBtn = node.querySelector('.cancel-btn');
      const archiveBtn = node.querySelector('.archive-btn');
      const deleteBtn = node.querySelector('.delete-btn');

      // Complete button
      if (order.status === 'cancelled' || order.status === 'archived') {
        completeBtn.textContent = 'Restore';
        completeBtn.dataset.status = 'pending';
      } else if (order.status === 'completed') {
        completeBtn.textContent = 'Mark pending';
        completeBtn.dataset.status = 'pending';
      } else {
        completeBtn.textContent = 'Mark done';
        completeBtn.dataset.status = 'completed';
      }
      completeBtn.dataset.id = order.id;

      // Cancel button
      if (order.status === 'cancelled') {
        cancelBtn.textContent = 'Restore';
        cancelBtn.dataset.status = 'pending';
      } else {
        cancelBtn.textContent = 'Cancel';
        cancelBtn.dataset.status = 'cancelled';
      }
      cancelBtn.dataset.id = order.id;

      // Archive button
      if (order.status === 'archived') {
        archiveBtn.textContent = 'Unarchive';
        archiveBtn.dataset.status = 'pending';
      } else {
        archiveBtn.textContent = 'Archive';
        archiveBtn.dataset.status = 'archived';
      }
      archiveBtn.dataset.id = order.id;

      deleteBtn.dataset.id = order.id;

      queueEl.appendChild(node);
    });
  } catch (err) {
    console.error(err);
    queueEl.innerHTML = `<p class="error">${err.message}</p>`;
  } finally {
    queueEl.dataset.loading = 'false';
  }
};

const submitOrder = async (payload) => {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to save order');
  }
};

const updateStatus = async (id, status) => {
  const res = await fetch(`/api/orders/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update status');
  }
};

const deleteOrder = async (id) => {
  const res = await fetch(`/api/orders/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete order');
  }
};

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.quantity = Number(payload.quantity);
  if (!payload.shipBy) {
    delete payload.shipBy;
  }
  try {
    form.classList.add('is-busy');
    await submitOrder(payload);
    form.reset();
    await updateQueue();
  } catch (err) {
    alert(err.message);
  } finally {
    form.classList.remove('is-busy');
  }
});

queueEl.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  if (button.classList.contains('complete-btn') || button.classList.contains('cancel-btn') || button.classList.contains('archive-btn')) {
    try {
      await updateStatus(button.dataset.id, button.dataset.status);
      await updateQueue();
    } catch (err) {
      alert(err.message);
    }
  } else if (button.classList.contains('delete-btn')) {
    if (!button.dataset.confirming) {
      button.dataset.confirming = 'true';
      button.textContent = 'Sure?';
      button.classList.add('is-confirming');
      clearTimeout(button._resetTimer);
      button._resetTimer = setTimeout(() => {
        delete button.dataset.confirming;
        button.textContent = 'Delete';
        button.classList.remove('is-confirming');
      }, 3000);
      return;
    }
    clearTimeout(button._resetTimer);
    try {
      await deleteOrder(button.dataset.id);
      await updateQueue();
    } catch (err) {
      alert(err.message);
    }
  }
});

chips.forEach((chip) => {
  chip.addEventListener('click', async () => {
    chips.forEach((c) => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    currentFilter = chip.dataset.filter;
    await updateQueue();
  });
});

refreshBtn.addEventListener('click', () => {
  updateQueue();
});

autoRefreshToggle.addEventListener('change', () => {
  clearInterval(autoRefreshTimer);
  if (autoRefreshToggle.checked) {
    autoRefreshTimer = setInterval(updateQueue, 30_000);
  }
});

// Start auto-refresh on by default at 30s
autoRefreshToggle.checked = true;
autoRefreshTimer = setInterval(updateQueue, 30_000);

updateQueue();
