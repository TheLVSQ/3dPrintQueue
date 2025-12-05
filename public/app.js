const queueEl = document.getElementById('queue');
const form = document.getElementById('order-form');
const chips = document.querySelectorAll('.status-filter .chip');
const refreshBtn = document.getElementById('refresh-btn');
const autoRefreshToggle = document.getElementById('auto-refresh');
const template = document.getElementById('order-card-template');

let currentFilter = 'pending';
let autoRefreshTimer = null;

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

const updateQueue = async () => {
  queueEl.dataset.loading = 'true';
  try {
    const orders = await fetchOrders();
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
      const archiveBtn = node.querySelector('.archive-btn');
      const deleteBtn = node.querySelector('.delete-btn');
      completeBtn.textContent = order.status === 'completed' ? 'Mark pending' : 'Mark done';
      completeBtn.dataset.id = order.id;
      completeBtn.dataset.status = order.status === 'completed' ? 'pending' : 'completed';
      archiveBtn.textContent = order.status === 'archived' ? 'Unarchive' : 'Archive';
      archiveBtn.dataset.id = order.id;
      archiveBtn.dataset.status = order.status === 'archived' ? 'pending' : 'archived';
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
  if (button.classList.contains('complete-btn')) {
    try {
      await updateStatus(button.dataset.id, button.dataset.status);
      await updateQueue();
    } catch (err) {
      alert(err.message);
    }
  } else if (button.classList.contains('archive-btn')) {
    try {
      await updateStatus(button.dataset.id, button.dataset.status);
      await updateQueue();
    } catch (err) {
      alert(err.message);
    }
  } else if (button.classList.contains('delete-btn')) {
    if (!confirm('Remove this order?')) return;
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
    autoRefreshTimer = setInterval(updateQueue, 60_000);
  }
});

updateQueue();


