if (!isLoggedIn()) {
    redirectTo(LOGIN_PAGE);
}

let revenueChartInstance = null;
let productChartInstance = null;
let categoryChartInstance = null;
let monthlyChartInstance = null;
let weekdayChartInstance = null;
let dashboardReportState = null;

const DAYS_IN_RANGE = {
    "7": 7,
    "30": 30
};

document.addEventListener("DOMContentLoaded", () => {
    applyStoredTheme();

    const themeToggle = document.getElementById("themeToggle");
    const cafeSwitcher = document.getElementById("cafeSwitcher");
    const dateFilter = document.getElementById("dateFilter");
    const downloadButton = document.getElementById("downloadReportBtn");

    themeToggle.addEventListener("click", toggleTheme);
    cafeSwitcher.addEventListener("change", loadDashboard);
    dateFilter.addEventListener("change", loadDashboard);
    downloadButton.addEventListener("click", downloadAnalysisReport);

    setReportButtonsDisabled(true);

    loadCafeSwitcher();
});

async function loadCafeSwitcher() {
    const switcher = document.getElementById("cafeSwitcher");

    try {
        const cafes = await cafesAPI.getAll();

        if (!cafes.length) {
            switcher.innerHTML = '<option value="">No cafes available</option>';
            renderEmptyDashboard(
                "Create your first cafe to unlock the dashboard and analytics."
            );
            return;
        }

        switcher.innerHTML = cafes.map(cafe => (
            `<option value="${cafe.id}">${cafe.name}</option>`
        )).join("");

        const savedCafeId = getSelectedCafe();
        const matchingCafe = cafes.find(cafe => String(cafe.id) === savedCafeId);
        switcher.value = matchingCafe ? savedCafeId : String(cafes[0].id);

        loadDashboard();
    } catch (error) {
        renderEmptyDashboard(error.message);
        showNotification(`Failed to load cafes: ${error.message}`, "error");
    }
}

async function loadDashboard() {
    const cafeSwitcher = document.getElementById("cafeSwitcher");
    const range = document.getElementById("dateFilter").value;
    const cafeId = cafeSwitcher.value;

    if (!cafeId) {
        return;
    }

    saveSelectedCafe(cafeId);
    setLoadingState(true);
    showNotification("Loading dashboard data...", "info");

    try {
        const [summary, revenue, monthly, products, categories, cafes] =
            await Promise.all([
                analyticsAPI.getSummary(cafeId, range),
                analyticsAPI.getRevenue(cafeId, "daily", range),
                analyticsAPI.getRevenue(cafeId, "monthly", range),
                analyticsAPI.getProducts(cafeId, range),
                analyticsAPI.getCategories(cafeId, range),
                cafesAPI.getAll()
            ]);

        const currentCafe = cafes.find(cafe => String(cafe.id) === String(cafeId));
        const filteredRevenue = revenue.breakdown || [];
        const trend = calculateTrend(filteredRevenue);
        const insights = buildInsights(summary, products, categories, trend, range);

        dashboardReportState = {
            cafe: currentCafe || null,
            range,
            summary,
            revenue,
            monthly,
            products,
            categories,
            trend,
            insights,
            generatedAt: new Date().toISOString()
        };

        renderHeader(currentCafe, summary, range, trend);
        renderKPIs(summary, trend);
        renderRevenueChart(revenue);
        renderMonthlyChart(monthly);
        renderProductChart(products);
        renderCategoryChart(categories);
        renderWeekdayChart(filteredRevenue);
        renderHeatmap(filteredRevenue);
        renderInsights(insights);
        renderEmptyStateMessage(summary, filteredRevenue);
        setReportButtonsDisabled(false);

        showNotification("Dashboard updated.", "success");
    } catch (error) {
        dashboardReportState = null;
        setReportButtonsDisabled(true);
        renderEmptyDashboard(error.message);
        showNotification(`Failed to load dashboard: ${error.message}`, "error");
    } finally {
        setLoadingState(false);
    }
}

function renderHeader(cafe, summary, range, trend) {
    const user = getUser();
    const subtitle = document.getElementById("dashboardSubtitle");
    const cafeName = document.getElementById("heroCafeName");
    const cafeMeta = document.getElementById("heroCafeMeta");
    const revenue = document.getElementById("heroRevenue");
    const orders = document.getElementById("heroOrders");
    const trendBadge = document.getElementById("trendBadge");
    const rangeLabel = document.getElementById("rangeLabel");

    subtitle.textContent = user
        ? `Welcome back, ${user.username}. Here is the latest view of your cafe performance.`
        : "Cafe performance at a glance.";

    cafeName.textContent = cafe?.name || "Cafe overview";
    cafeMeta.textContent = cafe?.location
        ? `${cafe.location} | ${formatRangeLabel(range)}`
        : formatRangeLabel(range);
    revenue.textContent = formatCurrency(summary.total_revenue);
    orders.textContent = `${formatNumber(summary.total_orders)} orders`;
    rangeLabel.textContent = formatRangeLabel(range);

    trendBadge.textContent = trend.label;
    trendBadge.className = `trend-badge ${trend.direction}`;
}

function renderKPIs(summary, trend) {
    document.getElementById("kpiRevenue").textContent =
        formatCurrency(summary.total_revenue);
    document.getElementById("kpiOrders").textContent =
        formatNumber(summary.total_orders);
    document.getElementById("kpiAvg").textContent =
        formatCurrency(summary.avg_order_value);
    document.getElementById("kpiProduct").textContent =
        summary.best_product || "No sales yet";

    document.getElementById("kpiRevenueHint").textContent =
        `${trend.direction === "up" ? "Momentum is improving" : "Track recent sales pace"}`;
    document.getElementById("kpiOrdersHint").textContent =
        `${formatNumber(summary.total_units_sold)} units sold`;
    document.getElementById("kpiAvgHint").textContent =
        summary.avg_order_value >= 300
            ? "Strong basket size"
            : "Bundle items to raise ticket value";
    document.getElementById("kpiProductHint").textContent =
        summary.best_category
            ? `Leading category: ${summary.best_category}`
            : "Upload sales data to reveal top items";
}

function renderRevenueChart(data) {
    const canvas = document.getElementById("revenueChart");
    const labels = data.breakdown.map(item => formatDateLabel(item.period));
    const values = data.breakdown.map(item => item.revenue);

    revenueChartInstance = replaceChart(revenueChartInstance, canvas, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label: "Revenue",
                data: values,
                borderColor: "#ff7b54",
                backgroundColor: "rgba(255, 123, 84, 0.18)",
                fill: true,
                tension: 0.35,
                pointBackgroundColor: "#fff7ed",
                pointBorderColor: "#ff7b54",
                pointRadius: 3
            }]
        },
        options: getChartOptions({
            yTickFormatter: value => formatCurrency(value)
        })
    });
}

function renderMonthlyChart(data) {
    const canvas = document.getElementById("monthlyChart");

    monthlyChartInstance = replaceChart(monthlyChartInstance, canvas, {
        type: "bar",
        data: {
            labels: data.breakdown.map(item => item.period),
            datasets: [{
                label: "Monthly revenue",
                data: data.breakdown.map(item => item.revenue),
                backgroundColor: ["#ffb26b", "#ffd56f", "#79c99e", "#7db7ff"],
                borderRadius: 14,
                borderSkipped: false
            }]
        },
        options: getChartOptions({
            yTickFormatter: value => formatCurrency(value)
        })
    });
}

function renderProductChart(data) {
    const canvas = document.getElementById("productChart");
    const topProducts = data.products.slice(0, 5);

    productChartInstance = replaceChart(productChartInstance, canvas, {
        type: "bar",
        data: {
            labels: topProducts.map(item => item.name),
            datasets: [{
                label: "Product revenue",
                data: topProducts.map(item => item.total_revenue),
                backgroundColor: [
                    "#ff7b54",
                    "#ffd56f",
                    "#7db7ff",
                    "#79c99e",
                    "#d39cff"
                ],
                borderRadius: 14,
                borderSkipped: false
            }]
        },
        options: getChartOptions({
            indexAxis: "y",
            yTickFormatter: value => value,
            xTickFormatter: value => formatCurrency(value)
        })
    });
}

function renderCategoryChart(data) {
    const canvas = document.getElementById("categoryChart");

    categoryChartInstance = replaceChart(categoryChartInstance, canvas, {
        type: "doughnut",
        data: {
            labels: data.categories.map(item => item.category),
            datasets: [{
                data: data.categories.map(item => item.total_revenue),
                backgroundColor: [
                    "#ff7b54",
                    "#ffd56f",
                    "#79c99e",
                    "#7db7ff",
                    "#d39cff"
                ],
                borderColor: "rgba(255, 255, 255, 0.12)",
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: getChartTextColor(),
                        usePointStyle: true,
                        padding: 18
                    }
                }
            }
        }
    });
}

function renderWeekdayChart(breakdown) {
    const canvas = document.getElementById("weekdayChart");
    const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const values = new Array(7).fill(0);

    breakdown.forEach(item => {
        const index = new Date(item.period).getDay();
        values[index] += item.revenue;
    });

    weekdayChartInstance = replaceChart(weekdayChartInstance, canvas, {
        type: "radar",
        data: {
            labels,
            datasets: [{
                label: "Revenue by weekday",
                data: values,
                borderColor: "#79c99e",
                backgroundColor: "rgba(121, 201, 158, 0.2)",
                pointBackgroundColor: "#79c99e"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: getChartTextColor()
                    }
                }
            },
            scales: {
                r: {
                    angleLines: { color: getGridColor() },
                    grid: { color: getGridColor() },
                    pointLabels: { color: getChartTextColor() },
                    ticks: {
                        color: getChartTextColor(),
                        backdropColor: "transparent",
                        callback: value => formatCurrency(value)
                    }
                }
            }
        }
    });
}

function renderHeatmap(breakdown) {
    const container = document.getElementById("heatmap");

    if (!breakdown.length) {
        container.innerHTML =
            '<div class="heatmap-empty">No sales data available for this period.</div>';
        return;
    }

    const highestRevenue = Math.max(...breakdown.map(item => item.revenue), 0);

    container.innerHTML = breakdown.map(item => {
        const intensity = highestRevenue ? item.revenue / highestRevenue : 0;
        const level = Math.max(1, Math.ceil(intensity * 5));
        return `
            <div class="heat-cell heat-level-${level}">
                <span class="heat-day">${formatDateLabel(item.period)}</span>
                <strong>${formatCurrency(item.revenue)}</strong>
            </div>
        `;
    }).join("");
}

function buildInsights(summary, products, categories, trend, range) {
    const topProduct = products.products[0];
    const lowProduct = products.products[products.products.length - 1];
    const topCategory = categories.categories[0];

    return [
        {
            title: "Best seller",
            body: topProduct
                ? `${topProduct.name} generated ${formatCurrency(topProduct.total_revenue)} and contributed ${topProduct.revenue_share}% of revenue.`
                : "Upload sales to identify your strongest product."
        },
        {
            title: "Category focus",
            body: topCategory
                ? `${topCategory.category} is leading this ${formatRangeLabel(range).toLowerCase()} with ${formatCurrency(topCategory.total_revenue)}.`
                : "Category insights will appear once products have sales."
        },
        {
            title: "Order quality",
            body: summary.avg_order_value >= 300
                ? `Average order value is ${formatCurrency(summary.avg_order_value)}, which is a healthy basket size.`
                : `Average order value is ${formatCurrency(summary.avg_order_value)}. Try pairing snacks and drinks to lift it.`
        },
        {
            title: "Trend signal",
            body: trend.description
        },
        {
            title: "Attention area",
            body: lowProduct && lowProduct !== topProduct
                ? `${lowProduct.name} is your weakest performer at ${formatCurrency(lowProduct.total_revenue)}. Consider a combo offer or menu refresh.`
                : "Once more products are tracked, weaker performers will appear here."
        }
    ];
}

function renderInsights(insights) {
    const box = document.getElementById("insightsBox");
    box.innerHTML = insights.map(insight => `
        <article class="insight-card">
            <h4>${insight.title}</h4>
            <p>${insight.body}</p>
        </article>
    `).join("");
}

function renderEmptyStateMessage(summary, breakdown) {
    const emptyState = document.getElementById("dashboardEmptyState");

    if (summary.total_orders > 0 || breakdown.length > 0) {
        emptyState.style.display = "none";
        return;
    }

    emptyState.style.display = "flex";
    emptyState.innerHTML = `
        <h3>No sales in this view yet</h3>
        <p>Upload a CSV from the Upload Sales page to fill the charts and insights.</p>
        <a href="upload.html" class="dashboard-link-button">Upload sales data</a>
    `;
}

function renderEmptyDashboard(message) {
    dashboardReportState = null;
    setReportButtonsDisabled(true);
    document.getElementById("dashboardSubtitle").textContent =
        "Dashboard data is currently unavailable.";
    document.getElementById("heroCafeName").textContent = "Dashboard unavailable";
    document.getElementById("heroCafeMeta").textContent = message;
    document.getElementById("heroRevenue").textContent = formatCurrency(0);
    document.getElementById("heroOrders").textContent = "0 orders";
    document.getElementById("trendBadge").textContent = "Waiting for data";
    document.getElementById("rangeLabel").textContent = "No active range";

    renderKPIs({
        total_revenue: 0,
        total_orders: 0,
        avg_order_value: 0,
        total_units_sold: 0,
        best_product: null,
        best_category: null
    }, { direction: "flat" });

    document.getElementById("insightsBox").innerHTML = `
        <article class="insight-card">
            <h4>Issue detected</h4>
            <p>${message}</p>
        </article>
    `;

    document.getElementById("heatmap").innerHTML =
        '<div class="heatmap-empty">No chart data to display.</div>';

    const emptyState = document.getElementById("dashboardEmptyState");
    emptyState.style.display = "flex";
    emptyState.innerHTML = `
        <h3>Dashboard could not be loaded</h3>
        <p>${message}</p>
    `;
}

function replaceChart(currentInstance, canvas, config) {
    if (currentInstance) {
        currentInstance.destroy();
    }

    return new Chart(canvas.getContext("2d"), config);
}

function getChartOptions({
    indexAxis = "x",
    xTickFormatter = value => value,
    yTickFormatter = value => value
} = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis,
        plugins: {
            legend: {
                labels: {
                    color: getChartTextColor(),
                    usePointStyle: true
                }
            }
        },
        scales: {
            x: {
                grid: { color: getGridColor() },
                ticks: {
                    color: getChartTextColor(),
                    callback: value => xTickFormatter(value)
                }
            },
            y: {
                grid: { color: getGridColor() },
                ticks: {
                    color: getChartTextColor(),
                    callback: value => yTickFormatter(value)
                }
            }
        }
    };
}

function calculateTrend(breakdown) {
    if (breakdown.length < 2) {
        return {
            direction: "flat",
            label: "Not enough data",
            description: "More daily sales data is needed before a reliable trend can be shown."
        };
    }

    const midpoint = Math.ceil(breakdown.length / 2);
    const firstHalf = breakdown.slice(0, midpoint);
    const secondHalf = breakdown.slice(midpoint);

    const firstHalfRevenue = firstHalf.reduce((sum, item) => sum + item.revenue, 0);
    const secondHalfRevenue = secondHalf.reduce((sum, item) => sum + item.revenue, 0);

    if (!firstHalfRevenue && !secondHalfRevenue) {
        return {
            direction: "flat",
            label: "No movement",
            description: "This range has no recorded sales yet."
        };
    }

    const change = firstHalfRevenue === 0
        ? 100
        : ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100;

    if (change > 8) {
        return {
            direction: "up",
            label: `${Math.round(change)}% up`,
            description: "Revenue accelerated in the later part of the selected period."
        };
    }

    if (change < -8) {
        return {
            direction: "down",
            label: `${Math.round(Math.abs(change))}% down`,
            description: "Revenue slowed in the later part of the selected period. Consider a short promotion or repeat-customer offer."
        };
    }

    return {
        direction: "flat",
        label: "Stable trend",
        description: "Revenue stayed broadly consistent across the selected period."
    };
}

function formatCurrency(value) {
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0
    }).format(Number(value || 0));
}

function formatNumber(value) {
    return new Intl.NumberFormat("en-IN").format(Number(value || 0));
}

function formatDateLabel(dateString) {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return dateString;
    }

    return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short"
    });
}

function formatRangeLabel(range) {
    if (DAYS_IN_RANGE[range]) {
        return `Last ${range} days`;
    }

    if (range === "month") {
        return "This month";
    }

    return "Selected period";
}

function getChartTextColor() {
    return document.body.classList.contains("dark-mode") ? "#e2e8f0" : "#334155";
}

function getGridColor() {
    return document.body.classList.contains("dark-mode")
        ? "rgba(148, 163, 184, 0.15)"
        : "rgba(148, 163, 184, 0.25)";
}

function setLoadingState(isLoading) {
    document.body.classList.toggle("dashboard-loading", isLoading);
}

function setReportButtonsDisabled(isDisabled) {
    const button = document.getElementById("downloadReportBtn");
    if (button) {
        button.disabled = isDisabled;
    }
}

function showNotification(message, type = "success") {
    const notification = document.getElementById("notification");
    notification.textContent = message;
    notification.className = `notification ${type} visible`;

    clearTimeout(showNotification.timeoutId);
    showNotification.timeoutId = setTimeout(() => {
        notification.classList.remove("visible");
    }, 2500);
}

function applyStoredTheme() {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
        document.body.classList.add("dark-mode");
    }
    updateThemeToggleLabel();
}

function toggleTheme() {
    document.body.classList.toggle("dark-mode");

    const theme = document.body.classList.contains("dark-mode")
        ? "dark"
        : "light";
    localStorage.setItem("theme", theme);

    updateThemeToggleLabel();
    loadDashboard();
}

function updateThemeToggleLabel() {
    const themeToggle = document.getElementById("themeToggle");
    if (!themeToggle) {
        return;
    }

    themeToggle.textContent = document.body.classList.contains("dark-mode")
        ? "Use light theme"
        : "Use dark theme";
}

function downloadAnalysisReport() {
    if (!dashboardReportState) {
        showNotification("Load dashboard data before downloading the report.", "error");
        return;
    }

    const reportHtml = buildReportHtml(dashboardReportState);
    const cafeName = dashboardReportState.cafe?.name || "cafe";
    const fileName = `${slugify(cafeName)}-${dashboardReportState.range}-analysis-report.docx`;
    let blob = null;

    if (window.htmlDocx?.asBlob) {
        blob = window.htmlDocx.asBlob(reportHtml, {
            orientation: "portrait",
            margins: {
                top: 720,
                right: 720,
                bottom: 720,
                left: 720
            }
        });
    } else {
        blob = new Blob(
            ["\ufeff", reportHtml],
            { type: "application/msword;charset=utf-8" }
        );
    }

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showNotification("Analysis report downloaded as Word document.", "success");
}

function buildReportHtml(reportState) {
    const {
        cafe,
        range,
        summary,
        revenue,
        monthly,
        products,
        categories,
        trend,
        insights,
        generatedAt
    } = reportState;

    const title = `${cafe?.name || "Cafe"} Analysis Report`;
    const location = cafe?.location || "Location not set";
    const productRows = products.products.slice(0, 10).map(product => `
        <tr>
            <td>${escapeHtml(product.name)}</td>
            <td>${escapeHtml(product.category || "Uncategorized")}</td>
            <td>${formatNumber(product.total_units)}</td>
            <td>${formatCurrency(product.total_revenue)}</td>
            <td>${product.revenue_share}%</td>
        </tr>
    `).join("");
    const categoryRows = categories.categories.map(category => `
        <tr>
            <td>${escapeHtml(category.category)}</td>
            <td>${formatNumber(category.total_units)}</td>
            <td>${formatCurrency(category.total_revenue)}</td>
            <td>${category.revenue_share}%</td>
        </tr>
    `).join("");
    const dailyRows = revenue.breakdown.map(item => `
        <tr>
            <td>${escapeHtml(formatDateLabel(item.period))}</td>
            <td>${formatCurrency(item.revenue)}</td>
            <td>${formatNumber(item.units_sold)}</td>
            <td>${formatNumber(item.total_orders)}</td>
        </tr>
    `).join("");
    const monthlyRows = monthly.breakdown.map(item => `
        <tr>
            <td>${escapeHtml(item.period)}</td>
            <td>${formatCurrency(item.revenue)}</td>
            <td>${formatNumber(item.units_sold)}</td>
            <td>${formatNumber(item.total_orders)}</td>
        </tr>
    `).join("");
    const insightCards = insights.map(insight => `
        <article class="insight">
            <h3>${escapeHtml(insight.title)}</h3>
            <p>${escapeHtml(insight.body)}</p>
        </article>
    `).join("");
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)}</title>
    <style>
        :root {
            color-scheme: light;
            --ink: #2f241f;
            --muted: #705c50;
            --accent: #c7683d;
            --accent-soft: #ffe7d6;
            --surface: #fffaf5;
            --surface-strong: #ffffff;
            --border: #e8d8ca;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 32px;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(180deg, #fff9f2 0%, #f6ede4 100%);
            color: var(--ink);
        }
        .report-shell {
            max-width: 1100px;
            margin: 0 auto;
            display: grid;
            gap: 24px;
        }
        .hero, .section, .metric {
            background: rgba(255, 255, 255, 0.94);
            border: 1px solid var(--border);
            border-radius: 24px;
        }
        .hero {
            padding: 28px;
            background: linear-gradient(135deg, #fff3e8, #fffdfb);
        }
        .eyebrow {
            font-size: 12px;
            letter-spacing: 0.18em;
            text-transform: uppercase;
            color: var(--accent);
            font-weight: 700;
        }
        h1, h2, h3, p {
            margin: 0;
        }
        h1 {
            font-size: 40px;
            margin-top: 10px;
        }
        .hero-meta {
            margin-top: 12px;
            color: var(--muted);
            line-height: 1.6;
        }
        .metric-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 16px;
        }
        .metric {
            padding: 20px;
        }
        .metric span {
            display: block;
            color: var(--muted);
            margin-bottom: 10px;
        }
        .metric strong {
            font-size: 28px;
        }
        .section {
            padding: 24px;
        }
        .section-header {
            margin-bottom: 18px;
        }
        .section-header p {
            margin-top: 8px;
            color: var(--muted);
        }
        .insight-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
        }
        .insight {
            padding: 18px;
            border-radius: 18px;
            background: var(--surface);
            border: 1px solid var(--border);
        }
        .insight p {
            margin-top: 8px;
            color: var(--muted);
            line-height: 1.6;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            overflow: hidden;
            border-radius: 18px;
            border: 1px solid var(--border);
        }
        th, td {
            padding: 14px 16px;
            text-align: left;
            border-bottom: 1px solid var(--border);
        }
        th {
            background: var(--accent-soft);
        }
        .empty {
            color: var(--muted);
            padding: 18px;
            border-radius: 18px;
            background: var(--surface);
            border: 1px dashed var(--border);
        }
        @media print {
            body {
                padding: 0;
                background: #fff;
            }
            .hero, .section, .metric {
                box-shadow: none;
                break-inside: avoid;
            }
        }
        @media (max-width: 800px) {
            body {
                padding: 18px;
            }
            .metric-grid, .insight-grid {
                grid-template-columns: 1fr;
            }
            h1 {
                font-size: 30px;
            }
        }
    </style>
</head>
<body>
    <div class="report-shell">
        <section class="hero">
            <p class="eyebrow">Cafelytics analysis report</p>
            <h1>${escapeHtml(title)}</h1>
            <p class="hero-meta">
                ${escapeHtml(location)}<br>
                Reporting period: ${escapeHtml(formatRangeLabel(range))}<br>
                Generated: ${escapeHtml(formatDateTimeLabel(generatedAt))}
            </p>
        </section>

        <section class="metric-grid">
            <article class="metric">
                <span>Total Revenue</span>
                <strong>${formatCurrency(summary.total_revenue)}</strong>
            </article>
            <article class="metric">
                <span>Total Orders</span>
                <strong>${formatNumber(summary.total_orders)}</strong>
            </article>
            <article class="metric">
                <span>Avg Order Value</span>
                <strong>${formatCurrency(summary.avg_order_value)}</strong>
            </article>
            <article class="metric">
                <span>Trend</span>
                <strong>${escapeHtml(trend.label)}</strong>
            </article>
        </section>

        <section class="section">
            <div class="section-header">
                <p class="eyebrow">Key findings</p>
                <h2>Recommended insights</h2>
                <p>Highlights generated from the selected cafe and date range in a simple text format.</p>
            </div>
            <div class="insight-grid">
                ${insightCards}
            </div>
        </section>

        <section class="section">
            <div class="section-header">
                <p class="eyebrow">Revenue timeline</p>
                <h2>Daily performance</h2>
                <p>Revenue, units sold, and order counts for the selected range.</p>
            </div>
            ${dailyRows ? `
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Revenue</th>
                            <th>Units Sold</th>
                            <th>Orders</th>
                        </tr>
                    </thead>
                    <tbody>${dailyRows}</tbody>
                </table>
            ` : '<div class="empty">No daily revenue data is available for this range.</div>'}
        </section>

        <section class="section">
            <div class="section-header">
                <p class="eyebrow">Monthly view</p>
                <h2>Monthly revenue breakdown</h2>
                <p>Longer-horizon revenue data for the selected cafe.</p>
            </div>
            ${monthlyRows ? `
                <table>
                    <thead>
                        <tr>
                            <th>Month</th>
                            <th>Revenue</th>
                            <th>Units Sold</th>
                            <th>Orders</th>
                        </tr>
                    </thead>
                    <tbody>${monthlyRows}</tbody>
                </table>
            ` : '<div class="empty">No monthly revenue data is available yet.</div>'}
        </section>

        <section class="section">
            <div class="section-header">
                <p class="eyebrow">Menu leaders</p>
                <h2>Top products</h2>
                <p>Highest-performing products by revenue contribution.</p>
            </div>
            ${productRows ? `
                <table>
                    <thead>
                        <tr>
                            <th>Product</th>
                            <th>Category</th>
                            <th>Units Sold</th>
                            <th>Revenue</th>
                            <th>Revenue Share</th>
                        </tr>
                    </thead>
                    <tbody>${productRows}</tbody>
                </table>
            ` : '<div class="empty">No product-level sales have been recorded yet.</div>'}
        </section>

        <section class="section">
            <div class="section-header">
                <p class="eyebrow">Category mix</p>
                <h2>Category performance</h2>
                <p>Revenue contribution by menu category.</p>
            </div>
            ${categoryRows ? `
                <table>
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Units Sold</th>
                            <th>Revenue</th>
                            <th>Revenue Share</th>
                        </tr>
                    </thead>
                    <tbody>${categoryRows}</tbody>
                </table>
            ` : '<div class="empty">No category-level sales have been recorded yet.</div>'}
        </section>
    </div>
</body>
</html>`;
}

function formatDateTimeLabel(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short"
    });
}

function slugify(value) {
    return String(value || "report")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "report";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
