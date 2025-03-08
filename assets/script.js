let articles = [];
let currentSortKey = "created_at";
let ascending = false;  // 初回は降順（新しい順）

document.getElementById("fetchButton").addEventListener("click", fetchArticles);
document.getElementById("toggleTokenVisibility").addEventListener("click", toggleTokenVisibility);

function toggleTokenVisibility() {
    let tokenInput = document.getElementById("accessToken");
    tokenInput.type = tokenInput.type === "password" ? "text" : "password";
}

async function fetchArticles() {
    const accessToken = document.getElementById("accessToken").value;
    if (!accessToken) {
        alert("アクセストークンを入力してください");
        return;
    }

    document.getElementById("errorMessage").innerText = "";  // エラーメッセージをクリア
    let page = 1;
    articles = [];

    try {
        // ユーザー情報を取得して @username を表示
        const userResponse = await fetch("https://qiita.com/api/v2/authenticated_user", {
            headers: { "Authorization": `Bearer ${accessToken}` }
        });

        if (!userResponse.ok) {
            throw new Error(`認証失敗: ${userResponse.status} ${userResponse.statusText}`);
        }

        const userData = await userResponse.json();
        document.getElementById("username").innerText = `@${userData.id}`;

        // ✅ 成功時にアクセストークン入力欄を非表示
        document.getElementById("tokenContainer").classList.add("hidden");
        document.getElementById("fetchButton").classList.add("hidden");

        // 記事を取得
        while (true) {
            const response = await fetch(`https://qiita.com/api/v2/authenticated_user/items?page=${page}&per_page=100`, {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });

            if (!response.ok) {
                throw new Error(`記事取得失敗: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            articles.push(...data);

            if (data.length < 100) break;
            page++;
        }

        sortTable(currentSortKey, true); // 初回ソート
    } catch (error) {
        document.getElementById("errorMessage").innerText = error.message;

        // ✅ エラー時は再表示
        document.getElementById("tokenContainer").classList.remove("hidden");
        document.getElementById("fetchButton").classList.remove("hidden");
    }
}

// ✅ `renderTable` を `window` に登録
window.renderTable = function() {
    const table = document.getElementById("articleTable");
    table.innerHTML = "";

    articles.forEach(article => {
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><a href="${article.url}" target="_blank">${article.title}</a></td>
            <td>${article.tags.map(tag => tag.name).join(", ")}</td>
            <td>${new Date(article.created_at).toLocaleDateString()}</td>
            <td>${new Date(article.updated_at).toLocaleDateString()}</td>
            <td>${article.page_views_count || 0}</td>
            <td>${article.likes_count}</td>
            <td>${article.stocks_count}</td>
        `;
        table.appendChild(row);
    });
};

// ✅ `sortTable` も `window` に登録
window.sortTable = function(key, initial = false) {
    if (!initial && currentSortKey === key) {
        ascending = !ascending;
    } else {
        currentSortKey = key;
        ascending = key === "created_at" ? false : true;
    }

    articles.sort((a, b) => {
        let valueA = a[currentSortKey] || 0;
        let valueB = b[currentSortKey] || 0;

        return ascending ? (valueA > valueB ? 1 : -1) : (valueA < valueB ? 1 : -1);
    });

    document.querySelectorAll(".sort-icon").forEach(el => el.innerText = "");
    document.getElementById(`sort-${key}`).innerText = ascending ? "▲" : "▼";

    renderTable();
};
