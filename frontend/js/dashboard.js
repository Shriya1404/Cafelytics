if (!isLoggedIn()) {
    redirectTo(LOGIN_PAGE);
}

let revenueChartInstance = null;
let productChartInstance = null;
let categoryChartInstance = null;
let monthlyChartInstance = null;
let weekdayChartInstance = null;

const DAYS_IN_RANGE = {
    "7": 7,
    "30": 30
};

document.addEventListener("DOMContentLoaded", () => {
    applyStoredTheme();

    const themeToggle = document.getElementById("themeToggle");
    const cafeSwitcher = document.getElementById("cafeSwitcher");
    const dateFilter = document.getElementById("dateFilter");

    themeToggle.addEventListener("click", toggleTheme);
    cafeSwitcher.addEventListener("change", loadDashboard);
    dateFilter.addEventListener("change", loadDashboard);

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

        renderHeader(currentCafe, summary, range, trend);
        renderKPIs(summary, trend);
        renderRevenueChart(revenue);
        renderMonthlyChart(monthly);
        renderProductChart(products);
        renderCategoryChart(categories);
        renderWeekdayChart(filteredRevenue);
        renderHeatmap(filteredRevenue);
        renderInsights(summary, products, categories, trend, range);
        renderEmptyStateMessage(summary, filteredRevenue);

        showNotification("Dashboard updated.", "success");
    } catch (error) {
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

function renderInsights(summary, products, categories, trend, range) {
    const box = document.getElementById("insightsBox");
    const topProduct = products.products[0];
    const lowProduct = products.products[products.products.length - 1];
    const topCategory = categories.categories[0];

    const insights = [
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
