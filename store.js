'use strict';

document.querySelectorAll('[data-catalog]').forEach((catalog) => {
  const form = catalog.querySelector('form');
  const list = catalog.querySelector('.catalog-grid');
  const cards = Array.from(list.children);
  const query = form.elements.q;
  const sort = form.elements.sort;
  const normalize = (value) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const update = () => {
    const terms = normalize(query.value.trim()).split(/\s+/).filter(Boolean);
    const visible = cards.filter((card) => {
      const matches = terms.every((term) => normalize(card.dataset.search).includes(term));
      card.hidden = !matches;
      return matches;
    });
    const ordered = cards.slice();
    if (sort.value === 'low') ordered.sort((a, b) => Number(a.dataset.price) - Number(b.dataset.price));
    if (sort.value === 'high') ordered.sort((a, b) => Number(b.dataset.price) - Number(a.dataset.price));
    if (sort.value === 'name') ordered.sort((a, b) => a.dataset.search.localeCompare(b.dataset.search));
    ordered.forEach((card) => list.append(card));
    catalog.querySelector('[data-results]').textContent = `${visible.length} ${visible.length === 1 ? 'product' : 'products'}`;
    catalog.querySelector('[data-empty]').hidden = visible.length !== 0;
  };
  query.value = new URLSearchParams(window.location.search).get('q') || '';
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const url = new URL(window.location.href);
    if (query.value.trim()) url.searchParams.set('q', query.value.trim());
    else url.searchParams.delete('q');
    window.history.replaceState(null, '', url);
    update();
  });
  query.addEventListener('input', update);
  sort.addEventListener('change', update);
  update();
});

document.querySelectorAll('[data-order-form]').forEach((form) => {
  const variant = form.elements.variant;
  const quantity = form.elements.quantity;
  const country = form.elements.country;
  const notes = form.elements.notes;
  const total = form.querySelector('[data-order-total]');
  const ready = form.querySelector('[data-order-ready]');
  const status = form.querySelector('[data-order-status]');
  const summary = form.querySelector('[data-order-summary]');
  const email = form.querySelector('[data-order-email]');
  const copy = form.querySelector('[data-copy-order]');
  const money = new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' });
  const requested = new URLSearchParams(window.location.search).get('variant');
  if (requested && Array.from(variant.options).some((option) => option.value === requested)) variant.value = requested;

  const update = () => {
    country.setCustomValidity(country.value.trim() ? '' : 'Enter the delivery country.');
    const option = variant.selectedOptions[0];
    const count = Number(quantity.value);
    const validCount = quantity.validity.valid && Number.isInteger(count) && count >= 1;
    const subtotal = Number(option?.dataset.price) * count;
    total.textContent = option?.value && validCount ? money.format(subtotal) : 'Select size and quantity';
    if (!form.checkValidity()) {
      ready.hidden = true;
      email.href = 'mailto:115moto@115moto.com';
      summary.value = '';
      return false;
    }
    const body = [
      'Hello 115moto,', '', 'Please confirm this order request:',
      `Model: ${form.dataset.product}`,
      `Size / inseam: ${option.dataset.size}`,
      `SKU: ${option.value}`,
      `Quantity: ${count}`,
      `Catalogue unit price: ${money.format(Number(option.dataset.price))}`,
      `Item subtotal: ${money.format(subtotal)}`,
      `Delivery country: ${country.value.trim()}`,
      `Product: ${form.dataset.url}?variant=${encodeURIComponent(option.value)}`,
      '', 'Please confirm availability, the final total, shipping and payment instructions.',
      'I understand that this request does not confirm or pay for an order.',
      ...(notes.value.trim() ? ['', `Notes: ${notes.value.trim()}`] : []),
    ].join('\n');
    summary.value = body;
    email.href = `mailto:115moto@115moto.com?subject=${encodeURIComponent(`Order enquiry: ${form.dataset.product}`)}&body=${encodeURIComponent(body)}`;
    return true;
  };
  form.addEventListener('input', () => {
    update();
    status.textContent = '';
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity() || !update()) return;
    ready.hidden = false;
    status.textContent = 'Request prepared below. Nothing has been sent. Open the email draft or copy the request.';
    summary.focus();
  });
  copy.addEventListener('click', async () => {
    if (!update()) return;
    try {
      await navigator.clipboard.writeText(summary.value);
      status.textContent = 'Request copied. Paste it into your email and send it to 115moto@115moto.com.';
    } catch {
      summary.focus();
      summary.select();
      status.textContent = 'Select and copy the request below, then paste it into your email.';
    }
  });
  update();
  form.querySelector('button[type="submit"]').disabled = false;
});

document.querySelectorAll('.static-menu').forEach((menu) => {
  menu.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      menu.open = false;
      menu.querySelector('summary').focus();
    }
  });
  document.addEventListener('click', (event) => {
    if (!menu.contains(event.target)) menu.open = false;
  });
});
