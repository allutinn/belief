let questions = [];
let currentQuestion = 0;

const questionText = document.getElementById("questionText");
const rangeInput = document.getElementById("likertRange");
const valueDisplay = document.getElementById("sliderValue");
const labelDisplay = document.getElementById("sliderLabel");
const voteBtn = document.getElementById("voteBtn");
const resultsContainer = document.getElementById("results-container");
const chartContainer = document.getElementById("chartContainer");

function getQueryParam(key) {
    const params = new URLSearchParams(window.location.search);
    return params.has(key) ? params.get(key) : null;
}

function getLabel(value) {
    if (value < 1.5) return "Strongly Disagree";
    if (value < 2.5) return "Disagree";
    if (value < 3.5) return "Neutral";
    if (value < 4.5) return "Agree";
    return "Strongly Agree";
}

function getVotedValue(questionId) {
    const val = localStorage.getItem(`voteValue_${questionId}`);
    return val ? parseFloat(val) : null;
}

function updateQuestion() {
    const question = questions[currentQuestion];
    questionText.textContent = `"${question.text}"`;
    rangeInput.value = 3;
    valueDisplay.textContent = "3.0";
    labelDisplay.textContent = getLabel(3.0);

    const likertEl = document.querySelector(".likert-scale");

    if (hasVoted(question.id)) {
        likertEl.style.display = "none";
        voteBtn.style.display = "none";
        fetchResults(question.id);
    } else {
        likertEl.style.display = "flex";
        resultsContainer.style.display = "none";
        voteBtn.style.display = "inline-block";
    }

    document.getElementById("prevBtn").style.visibility = currentQuestion === 0 ? "hidden" : "visible";
    document.getElementById("nextBtn").style.visibility = currentQuestion === questions.length - 1 ? "hidden" : "visible";

    const qid = questions[currentQuestion].id;
    const url = new URL(window.location);
    url.searchParams.set("q", qid);
    window.history.replaceState({}, "", url);
}

async function fetchQuestions() {
    const res = await fetch("/api/questions");
    questions = await res.json();

    const paramQ = parseInt(getQueryParam("q"), 10);
    const matchIndex = questions.findIndex(q => q.id === paramQ);

    currentQuestion = matchIndex !== -1 ? matchIndex : 0;
    updateQuestion();
}

rangeInput.addEventListener("input", () => {
    const value = parseFloat(rangeInput.value).toFixed(1);
    valueDisplay.textContent = value;
    labelDisplay.textContent = getLabel(value);
});

voteBtn.addEventListener("click", async () => {
    const questionId = questions[currentQuestion].id;
    if (hasVoted(questionId)) {
        alert("You have already voted on this question.");
        return;
    }

    const value = parseFloat(rangeInput.value).toFixed(1);
    const res = await fetch("/api/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, value })
    });

    if (res.ok) {
        markVoted(questionId, value);
        await fetchResults(questionId);
    } else {
        alert("Failed to vote.");
    }
});

async function fetchResults(questionId) {
    const res = await fetch(`/api/results/${questionId}`);
    const data = await res.json();

    const votedValue = getVotedValue(questionId);
    const votedBin = votedValue ? Math.round(votedValue * 10) / 10 : null;

    chartContainer.innerHTML = "";

    const bars = data.bins.map((binValue, i) => {
        const bin = parseFloat(binValue).toFixed(1);
        const isVoted = parseFloat(bin) === parseFloat(votedBin);
        const rounded = Math.round(bin);
        const showLabel = (Math.abs(bin - rounded) < 0.05) && rounded >= 1 && rounded <= 5;

        return `
        <div class="chart-bar-container" style="position: relative">
            <div class="chart-number">${showLabel ? rounded : ""}</div>
            <div class="chart-bar-wrapper">
                <div class="chart-bar ${isVoted ? 'voted-bar' : ''}" data-index="${i}"></div>
            </div>
            <div class="chart-label">${showLabel ? getLabel(rounded) : ""}</div>
        </div>`;
    }).join("");

    chartContainer.innerHTML = bars;

    setTimeout(() => {
        data.percentages.forEach((pct, i) => {
            const bar = chartContainer.querySelector(`.chart-bar[data-index="${i}"]`);
            if (bar) {
                bar.style.transition = "width 0.3s ease-out";
                bar.style.width = `${pct}%`;
            }
        });
    }, 10);

    document.getElementById("totalVotes").textContent = data.totalVotes;
    document.getElementById("avgScore").textContent = data.avg;

    document.querySelector(".likert-scale").style.display = "none";
    resultsContainer.style.display = "block";
    voteBtn.style.display = "none";
}

document.getElementById("prevBtn").addEventListener("click", () => {
    if (currentQuestion > 0) {
        currentQuestion--;
        updateQuestion();
    }
});

document.getElementById("nextBtn").addEventListener("click", () => {
    if (currentQuestion < questions.length - 1) {
        currentQuestion++;
        updateQuestion();
    }
});

function hasVoted(questionId) {
    const voted = JSON.parse(localStorage.getItem("votedQuestions") || "[]");
    return voted.includes(questionId);
}

function markVoted(questionId, value) {
    const voted = JSON.parse(localStorage.getItem("votedQuestions") || "[]");
    if (!voted.includes(questionId)) {
        voted.push(questionId);
        localStorage.setItem("votedQuestions", JSON.stringify(voted));
    }
    localStorage.setItem(`voteValue_${questionId}`, value);
}

fetchQuestions();
