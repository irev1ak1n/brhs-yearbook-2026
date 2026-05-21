const sportsHome = document.getElementById("sportsHome");

const sportView = document.getElementById("sportView");

const sportTitle = document.getElementById("sportTitle");

const sportsGallery = document.getElementById("sportsGallery");

const backToSports = document.getElementById("backToSports");

const sportCards = document.querySelectorAll(".yb-sport-card");

const sportImages = {

    football: [

        "../assets/images/sports/football/football-1.jpg",
        "../assets/images/sports/football/football-2.jpg",
        "../assets/images/sports/football/football-3.jpg",
        "../assets/images/sports/football/football-4.jpg",
        "../assets/images/sports/football/football-5.jpg"

    ],

    baseball: [

        "../assets/images/sports/baseball/baseball-1.jpg",
        "../assets/images/sports/baseball/baseball-2.jpg",
        "../assets/images/sports/baseball/baseball-3.jpg",
        "../assets/images/sports/baseball/baseball-4.jpg"

    ],

    basketball: [

        "../assets/images/sports/basketball/basketball-1.jpg",
        "../assets/images/sports/basketball/basketball-2.jpg",
        "../assets/images/sports/basketball/basketball-3.jpg",
        "../assets/images/sports/basketball/basketball-4.jpg"

    ]

};

const sportNames = {

    football: "Football",

    baseball: "Baseball",

    basketball: "Basketball"

};

sportCards.forEach((card) => {

    card.addEventListener("click", () => {

        const sport = card.dataset.sport;

        openSport(sport);

    });

});

backToSports.addEventListener("click", () => {

    sportView.hidden = true;

    sportsHome.hidden = false;

    sportsGallery.innerHTML = "";

    window.scrollTo({

        top: 0,
        behavior: "smooth"

    });

});

function openSport(sport) {

    sportsHome.hidden = true;

    sportView.hidden = false;

    sportTitle.textContent = sportNames[sport];

    sportsGallery.innerHTML = "";

    sportImages[sport].forEach((image) => {

        const item = document.createElement("div");

        item.className = "yb-sports-photo";

        item.innerHTML = `
            <img src="${image}" alt="${sportNames[sport]} photo">
        `;

        sportsGallery.appendChild(item);

    });

    window.scrollTo({

        top: 0,
        behavior: "smooth"

    });

}