const $ = (s) => document.querySelector(s);
let currentUser = null;

async function loadUsers() {
    const users = await fetch('/api/users').then(r => r.json());
    const sel = $('#userSelect');
    sel.innerHTML = users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
    currentUser = users[0].id;
    sel.onchange = () => { currentUser = +sel.value; loadLoans(); };
}

async function loadBooks() {
    const q = $('#search').value;
    const books = await fetch('/api/books?q=' + encodeURIComponent(q)).then(r => r.json());
    $('#bookList').innerHTML = books.map(b => `
        <div class="card">
            <h3>${b.title}</h3>
            <div class="author">${b.author}</div>
            <div class="meta">재고 ${b.available_copies}/${b.total_copies} · ❤ ${b.like_count}</div>
            <div class="actions">
                <button class="btn-like" onclick="like(${b.id})">좋아요 <span class="tag">RC</span></button>
                <button class="btn-loan" onclick="loan(${b.id})">대출 <span class="tag">SER</span></button>
            </div>
        </div>`).join('');
}

async function loadLoans() {
    const loans = await fetch(`/api/users/${currentUser}/loans`).then(r => r.json());
    $('#loanTable tbody').innerHTML = loans.map(l => `
        <tr>
            <td>${l.title}</td>
            <td>${l.loaned_at.slice(0,10)}</td>
            <td>${l.due_date.slice(0,10)}</td>
            <td>${l.returned_at ? '반납완료' : '대출중'}</td>
            <td>${l.returned_at ? '' : `<button class="btn-return" onclick="returnLoan(${l.id})">반납</button>`}</td>
        </tr>`).join('');
}

async function like(book_id) {
    const r = await fetch(`/api/books/${book_id}/like`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ user_id: currentUser })
    });
    const d = await r.json();
    if (!r.ok) alert(d.error); else loadBooks();
}

async function loan(book_id) {
    const r = await fetch('/api/loans', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ user_id: currentUser, book_id })
    });
    const d = await r.json();
    if (!r.ok) alert(d.error); else { loadBooks(); loadLoans(); }
}

async function returnLoan(loan_id) {
    const r = await fetch(`/api/loans/${loan_id}/return`, { method:'POST' });
    const d = await r.json();
    if (!r.ok) alert(d.error); else { loadBooks(); loadLoans(); }
}

$('#search').addEventListener('input', loadBooks);

(async () => {
    await loadUsers();
    await loadBooks();
    await loadLoans();
})();
