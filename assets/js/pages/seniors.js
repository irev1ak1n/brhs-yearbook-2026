const seniorSort = document.getElementById("seniorSort");
const seniorsList = document.querySelector(".yb-seniors-list");

const originalCards = [...seniorsList.children];

seniorSort.addEventListener("change", () => {
    const cards = [...seniorsList.children];

    let sortedCards = cards;

    if (seniorSort.value === "default") {
        sortedCards = originalCards;
    }

    if (seniorSort.value === "name-az") {
        sortedCards = cards.sort((a, b) =>
            getName(a).localeCompare(getName(b))
        );
    }

    if (seniorSort.value === "name-za") {
        sortedCards = cards.sort((a, b) =>
            getName(b).localeCompare(getName(a))
        );
    }

    if (seniorSort.value === "college-az") {
        sortedCards = cards.sort((a, b) =>
            getCollege(a).localeCompare(getCollege(b))
        );
    }

    if (seniorSort.value === "college-za") {
        sortedCards = cards.sort((a, b) =>
            getCollege(b).localeCompare(getCollege(a))
        );
    }

    if (seniorSort.value === "major-az") {
        sortedCards = cards.sort((a, b) =>
            getMajor(a).localeCompare(getMajor(b))
        );
    }

    if (seniorSort.value === "major-za") {
        sortedCards = cards.sort((a, b) =>
            getMajor(b).localeCompare(getMajor(a))
        );
    }

    seniorsList.innerHTML = "";
    sortedCards.forEach(card => seniorsList.appendChild(card));
});

function getName(card) {
    return card.querySelector("h2").textContent.trim();
}

function getCollege(card) {
    return card
        .querySelector(".yb-senior-details")
        .textContent
        .split("•")[0]
        .trim();
}

function getMajor(card) {
    const details = card
        .querySelector(".yb-senior-details")
        .textContent
        .trim();

    const parts = details.split("•");

    return parts[1] ? parts[1].trim() : "Undeclared";
}