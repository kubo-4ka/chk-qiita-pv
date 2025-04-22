let articles = [];
let currentSortKey = "created_at";
let ascending = false;  // 初回は降順（新しい順）

document.getElementById("fetchButton").addEventListener("click", fetchArticles);
document.getElementById("toggleTokenVisibility").addEventListener("click", toggleTokenVisibility);
document.getElementById("exportCSV").addEventListener("click", exportCSV);
document.getElementById("exportPDF").addEventListener("click", exportPDF);

function toggleTokenVisibility() {
    let tokenInput = document.getElementById("accessToken");
    tokenInput.type = tokenInput.type === "password" ? "text" : "password";
}

// ✅ JST でファイル名を作成する関数（アンダースコア修正）
function getFormattedDateTime() {
    const now = new Date();
    const options = {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23" // 24時間制
    };

    const parts = new Intl.DateTimeFormat("ja-JP", options).formatToParts(now);
    const get = type => parts.find(p => p.type === type)?.value.padStart(2, "0");

    const yyyy = get("year");
    const mm = get("month");
    const dd = get("day");
    const hh = get("hour");
    const min = get("minute");
    const ss = get("second");

    return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
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

        // ✅ JST で取得時刻を表示
        const now = new Date();
        document.getElementById("fetchTime").innerText = `取得日時: ${now.toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`;

        // Qiita API から記事を取得
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

        // ✅ 取得成功後にダウンロードボタンを表示
        document.getElementById("exportCSV").classList.remove("hidden");
        document.getElementById("exportPDF").classList.remove("hidden");

        sortTable(currentSortKey, true); // 初回ソート
    } catch (error) {
        document.getElementById("errorMessage").innerText = error.message;

        // ✅ エラー時は再表示
        document.getElementById("tokenContainer").classList.remove("hidden");
        document.getElementById("fetchButton").classList.remove("hidden");
    }
}

// ✅ `renderTable` を `window` に登録
window.renderTable = function () {
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
window.sortTable = function (key, initial = false) {
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

function getUsername() {
    return document.getElementById("username").textContent.trim().replace("@", "") || "unknown_user";
}

function exportCSV() {
    const username = getUsername();
    const filename = `qiita_articles_${getFormattedDateTime()}_${username}.csv`;
    
    let csvContent = "タイトル,タグ,公開日,更新日,閲覧数,いいね数,ストック数\n";
    articles.forEach(article => {
        csvContent += `"${article.title}","${article.tags.map(tag => tag.name).join(", ")}","${article.created_at}","${article.updated_at}",${article.page_views_count || 0},${article.likes_count},${article.stocks_count}\n`;
    });

    const blob = new Blob([csvContent], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}

// ✅ Uint8Array を Base64 に変換する関数
function arrayBufferToBase64(buffer) {
    return new Promise((resolve) => {
        const blob = new Blob([buffer], { type: "application/octet-stream" });
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result.split(",")[1]);
        reader.readAsDataURL(blob);
    });
}

// ✅ PDFの日本語対応（フォント埋め込み & 初回ロードエラー修正）
async function exportPDF() {
    const username = getUsername();
    const filename = `qiita_articles_${getFormattedDateTime()}_${username}.pdf`;
    console.log("filename: " + filename);

    console.log("window.jspdf: " + window.jspdf);
    if (!window.jspdf || !window.jspdf.jsPDF) {
        alert("PDFライブラリが読み込まれていません。");
        return;
    }

    console.log("window.jspdf.jsPDF.API.autoTable: " + window.jspdf.jsPDF.API.autoTable);
    if (!window.jspdf.jsPDF.API.autoTable) {
        alert("PDFの表描画機能（autoTable）が正しくロードされていません。ページをリロードしてください。");
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "A4"
    });

    try {
        // ✅ フォントを正しく `Base64` に変換
        const response = await fetch("assets/ipaexg.ttf");
        const buffer = await response.arrayBuffer();
        const base64Font = await arrayBufferToBase64(buffer);

        // ✅ jsPDF にフォントを登録
        doc.addFileToVFS("ipaexg.ttf", base64Font);
        doc.addFont("ipaexg.ttf", "IPAexGothic", "normal");
        doc.setFont("IPAexGothic");

        generatePDF(doc, filename);
    } catch (error) {
        console.error("フォントの読み込みに失敗しました:", error);
        alert("フォントの読み込みに失敗しました。デフォルトフォントで出力します。");
        doc.setFont("times", "normal");
        generatePDF(doc, filename);
    }
}

function generatePDF(doc, filename) {
    const username = getUsername();
    const fetchTime = document.getElementById("fetchTime").textContent.trim() || "取得日時不明";

    // ✅ 画面と同じようにヘッダー情報を追加
    // ✅ PDF全体の背景を黒に
    doc.setFillColor(0, 0, 0); // 黒背景
    doc.rect(0, 0, doc.internal.pageSize.width, doc.internal.pageSize.height, "F"); // 全体を塗りつぶし
    doc.setTextColor(255, 255, 255); // 文字を白に
    doc.setFontSize(14);
    doc.text(`Qiita 記事一覧 (${username})`, 10, 10);
    doc.setFontSize(10);
    doc.text(fetchTime, 10, 20); // 取得日時

    const tableData = articles.map(article => [
        article.title,
        article.tags.map(tag => tag.name).join(", "),
        new Date(article.created_at).toLocaleDateString(),
        new Date(article.updated_at).toLocaleDateString(),
        article.page_views_count || 0,
        article.likes_count,
        article.stocks_count
    ]);

    doc.autoTable({
        head: [["タイトル", "タグ", "公開日", "更新日", "閲覧数", "いいね数", "ストック数"]],
        body: tableData,
        startY: 30, // ✅ 取得日時の下に表を配置
        styles: { 
            font: "IPAexGothic", 
            fontSize: 10, 
            cellWidth: 'wrap', 
            textColor: [255, 255, 255], // ✅ 文字を白に
            fillColor: [34, 34, 34] // ✅ 通常のセルをダークグレーに
        },
        headStyles: { 
            fillColor: [0, 0, 0], // ✅ ヘッダーの背景を黒に
            textColor: [255, 255, 255], // ✅ ヘッダーの文字を白に
            fontSize: 11
        },
        alternateRowStyles: { fillColor: [26, 26, 26] }, // ✅ 偶数行の背景をダークグレー
        rowStyles: { fillColor: [46, 46, 46] }, // ✅ 奇数行の背景を黒に

        columnStyles: {
            0: { cellWidth: 60 },  // タイトル
            1: { cellWidth: 40 },  // タグ
            2: { cellWidth: 25 },  // 公開日
            3: { cellWidth: 25 },  // 更新日
            4: { cellWidth: 20 },  // 閲覧数
            5: { cellWidth: 20 },  // いいね数
            6: { cellWidth: 20 },  // ストック数
        },
        margin: { left: 0, right: 0 }, // 余白
        overflow: 'linebreak'  // ✅ 長すぎるタグを自動改行
    });

    doc.save(filename);
}
