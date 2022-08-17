const PORT = 8000;
const axios = require("axios");
const cheerio = require("cheerio");
const express = require("express");
const app = express();
const dotenv = require("dotenv");
// init env file
dotenv.config();
// get number of page to scrap
const maxPageNumber = process.env.Max_Page_Count;

app.get("/", function (req, res) {
  res.json("This is my webscraper");
});

async function getNextPageUrl(pageNumber) {
  let data;
  let url;
  try {
    if (pageNumber == 1) {
      url = `https://www.otomoto.pl/ciezarowe/uzytkowe/mercedes-benz`;
    } else {
      url = `https://www.otomoto.pl/ciezarowe/uzytkowe/mercedes-benz?page=${pageNumber}`;
    }
    await axios.get(url).then((response) => {
      data = response.data;
    });
    return data;
  } catch (err) {
    console.log("error", err);
  }
}

async function getTotalAdsCount($, html, pageNumber) {
  console.log("pageNumber", pageNumber);
  let initalAdsThisPage = 0;
  $(".ooa-aolmt8.e1b25f6f17", html).each(function () {
    //<-- cannot be a function expression
    const id = $(this).attr("id");
    if (id) {
      initalAdsThisPage++;
    }
  });
  return initalAdsThisPage;
}

async function addItems($, html) {
  let addItemsPerPage = [];
  $(".ooa-aolmt8.e1b25f6f17", html).each(async function () {
    const url = $(this).find("a").attr("href");
    const id = $(this).attr("id");
    addItemsPerPage.push({ URL: url, ID: id });
  });
  return addItemsPerPage;
}

async function getEachTruckDetail(url) {
  let tructDetail = {};
  try {
    await axios.get(url).then(async (response) => {
      const html = response.data;
      const $ = cheerio.load(html);
      let offerParam = $(".offer-params", html);
      $(offerParam)
        .find(".offer-params__item")
        .get()
        .map((item, index) => {
          let label = $(item).find(".offer-params__label").text();
          let value = $(item).find(".offer-params__value").text();
          if (label == "Kolor") {
            //Color
            tructDetail["Color"] = value.trim();
          } else if (label == "Rok produkcji") {
            // year of production
            tructDetail["ProductionDate"] = value.trim();
          } else if (label == "Moc") {
            // Power
            tructDetail["Power"] = value.trim();
          } else if (label == "Pierwsza rejestracja") {
            // registration date
            tructDetail["RegistrationDate"] = value.trim();
          } else if (label == "Przebieg") {
            // millage
            tructDetail["Millage"] = value.trim();
          }
        });
    });
    return tructDetail;
  } catch (err) {
    console.log("err", err);
  }
}

async function scrapeTruckItem($, html) {
  let getTructItemPerPage = [];
  await Promise.all(
    $(".ooa-aolmt8.e1b25f6f17", html)
      .get()
      .map(async (ele) => {
        let id = $(ele).attr("id");
        let title = $(ele).find(".e1b25f6f12.ooa-1mgjl0z-Text.eu5v0x0").text();
        let price = $(ele).find(".ooa-epvm6.e1b25f6f7").text();
        const url = $(ele).find("a").attr("href");
        const selectedTruchDetail = await getEachTruckDetail(url);
        selectedTruchDetail["Item"] = id;
        selectedTruchDetail["Title"] = title;
        selectedTruchDetail["Price"] = price;
        getTructItemPerPage.push(selectedTruchDetail);
      })
  );
  return getTructItemPerPage;
}

// for rate limit error handle
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.get("/results", async (req, res) => {
  let data = {};
  for (let index = 1; index <= maxPageNumber; index++) {
    let pageHTML = await getNextPageUrl(index);
    const $ = cheerio.load(pageHTML);
    let getAddItems = await addItems($, pageHTML);
    let getTotalAdsCounts = await getTotalAdsCount($, pageHTML, index);
    let getAllScrapeTructItem = await scrapeTruckItem($, pageHTML);
    let page = `page ${index}`;
    data[page] = {
      getAddItems: getAddItems,
      getTotalAdsCounts: getTotalAdsCounts,
      getAllScrapeTructItem: getAllScrapeTructItem,
    };
    await sleep(4000);
  }
  res.send(data);
});
app.listen(PORT, () =>
  console.log(`Data Scraper Server is Running At PORT ${PORT}`)
);
