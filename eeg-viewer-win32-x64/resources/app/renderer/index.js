///////////////////////////////////////////////////////
//     This file is roughly split into 3 sections:   //
//   1. Menu and Navigation                          //
//   2. Operations with Files                        //
//   3. Generation of Data Widgets                   //
///////////////////////////////////////////////////////

const {dialog, ipcRenderer} = require("electron")
const settings = require("electron-settings")
const Chart = require("chart.js")
const feather = require('feather-icons')

// Constants and variables for menus and file processing
const navigation_menu = document.getElementById("navigation-menu")
const datasets_menu = document.getElementById("datasets-menu")
const dragFile = document.getElementById("drag-file")

let messages_ids = []
let filesToProccess = 0

// Utility function to create HTML DOM elements with given classes and attributes
createElement = (element, classes, attrs) => {
  let item = document.createElement(element)
  Array.isArray(classes) && classes.forEach(cls => {
    item.classList.add(cls)
  });
  (typeof attrs === "object") && Object.keys(attrs).forEach(key => {
    item.setAttribute(key, attrs[key])
  })
  return item
}

// Utility functions that show and hide spinner while app is loading
function showSpinner(result, i) {
  if (i !== undefined) {
    // Updated number of files to proccess if needed
    // (comes from event listener)
    filesToProccess = i + filesToProccess
  }
  let spinner = document.getElementById("spinner")
  spinner.classList.remove("d-none")
}

function hideSpinner() {
  let spinner = document.getElementById("spinner")
  spinner.classList.add("d-none")
}

///////////////////////////////////////////////////////////////////////////////
//                       1. Menu and Navigation                              //
///////////////////////////////////////////////////////////////////////////////

// Draw menus
drawMenu(navigation_menu, settings.get("navigation"))
drawMenu(datasets_menu, [])
feather.replace()

// This function draws menu based on settings defined in main.js
function drawMenu(menu, items) {
  if (items.length == 0 && menu === datasets_menu) {
    // If no files have been opened and there are no datasets yet
    let text = document.createTextNode("no data sets found");
    let menu_item = createElement("li", ["nav-link", "pl-5"])
    menu_item.appendChild(text)
    menu.appendChild(menu_item)
    return
  }
  // Otherwise generate menu based on settings
  items.forEach((item) => {
    let icon = createElement("span", [], {"data-feather": item["feather"]})
    let text = document.createTextNode(item["name"]);
    let link = createElement("a", ["nav-link"], {"href": "#"})
    if (item["active"]) {
      link.classList.add("active")
    }

    link.setAttribute(item["data"][0], item["data"][1])

    link.appendChild(icon)
    link.appendChild(text)

    let menu_item = createElement("li", ["nav-link"])
    menu_item.appendChild(link)
    menu.appendChild(menu_item)
  })
}

// This function draws data set menus, whenever new file is parsed and
// new datasets are recieved. Argument is currently open dataset.
// Note: It's easier to redraw the whole thing to avoid duplications
function updateDatasetMenu(filename) {
  // Get all datasets
  let datasets = settings.get("datasets")
  let menu = []
  datasets.forEach((dataset, ind) => {
    // Check if dataset is the currently open one
    let current_dataset = dataset["name"] == filename.match(/.+?(?=(?:\.[^.]*$|$))/)
    if (current_dataset) {
      settings.set("current_dataset", ind)
      changeActiveDataset()
    }
    // Draw an element of the menu
    menu.push({
      "name": dataset["name"],
      "data": ["data-dataset", ind],
      "feather": "bar-chart-2",
      "active": current_dataset
    })
  })
  // Delete old menu
  let old_menu = document.getElementById("datasets-menu")
  while (old_menu.firstChild) {
        old_menu.removeChild(old_menu.firstChild)
  }
  // Draw new menu
  drawMenu(datasets_menu, menu)
  feather.replace()
}

// Event listener for menu use
document.body.addEventListener("click", (event) => {
    let tpe = false
    if (event.target.dataset.section) {
      // Changing sections (File upload, Graphs, Raw data table)
      tpe = "section"
    } else if (event.target.dataset.dataset) {
      // Open different dataset
      tpe = "dataset"
    }
    if (tpe) {
      // Activate Spinner: some big datasets can take some time to load
      // And handle the navigation
      showSpinner()
      setTimeout(() => handleSectionTrigger(event, tpe), 0)
      setTimeout(hideSpinner, 0)
    }
})

// This functions handles results of menu navigation
function handleSectionTrigger (event, tpe) {
  if (settings.get("datasets").length > 0) {
    // Can navigate only after uploading at least one valid file
    //
    // Hide old sections and dehightlight link
    hideAllSectionsAndDeselectButtons(event, tpe)
    // Highlight clicked link
    event.target.classList.add("active")

    // Save current choise in settings and display the new section / dataset
    switch(tpe) {
      case "section":
        settings.set("section", event.target.dataset.section)
        changeSection(event.target.dataset.section)
        break
      case "dataset":
        settings.set("current_dataset", event.target.dataset.dataset)
        changeActiveDataset()
        break
    }
  }
}

// This function hides sections and dehighlightes links
function hideAllSectionsAndDeselectButtons (event, tpe) {
  if (tpe === "section") {
      // In case of section all content must be hidden
      let section = document.getElementById(settings.get("section"))
      section.classList.add("d-none")
  }

  let attr = "[data-" + tpe + "]"
  const links = document.querySelectorAll(attr)
  Array.prototype.forEach.call(links, (link) => {
    link.classList.remove("active")
  })
}

// These function shows newly selected section / dataset
function changeSection(id) {
  let section = document.getElementById(id)
  section.classList.remove("d-none")
}

function changeActiveDataset() {
  let ind = settings.get("current_dataset")
  let dataset = settings.get("datasets")[ind]

  function change(tag, data, key) {
    let old = document.querySelector(tag + "[id^=" + data + "]:not([class~=d-none])")
    if (old !== null) {
      old.classList.add("d-none")
    }
    let now = document.getElementById(dataset[key])
    now.classList.remove("d-none")
  }

  // Hide old charts and stats and show new ones
  change("canvas", "chart-data", "chart")
  change("div", "stat-data", "stat")

  // Hide old data table and show the new one
  change("table", "raw-data", "table")
}


///////////////////////////////////////////////////////////////////////////////
//                       2. Operations with Files                            //
///////////////////////////////////////////////////////////////////////////////

// Sends event that file(s) has been dropped
dragFile.addEventListener("drop", function (e) {
  e.preventDefault();
  let paths = Object.keys(e.dataTransfer.files).map(i => e.dataTransfer.files[i].path)
  ipcRenderer.send("uploadFiles", paths)
});

// This is required for the file drop to work
dragFile.addEventListener("dragover", function (e) {
  e.preventDefault();
});

// Sends event to open regular file rbowser
document.getElementById("open-file").addEventListener("click", function (e) {
  ipcRenderer.send("openFiles")
});

document.body.addEventListener("click", (event) => {
  if (event.target.id === "ok-message-file" && settings.get("section") === "open-file-section-container") {
    // delete all file messages and the button
    let msg_div = document.getElementById("message-file")
    while (msg_div.firstChild) {
      msg_div.removeChild(msg_div.firstChild)
    }
    hideFileButton()
  }
});

// Event listener for the beginning of file(s) parsing
ipcRenderer.on("loading", showSpinner)

// Event listeners for results of file(s) parsing
ipcRenderer.on("finishedFile", fileUploaded)
ipcRenderer.on("errorFile", fileUploaded)

// This function handles results of file parsing
function fileUploaded(result, filename, arg) {
  // arg is either error message (string) or indeces of new datasets in settings (array)
  if (typeof arg !== "string") {
    // No error => generate data widgets and update data set menu
    generateDatasetTable(arg)
    generateDatasetGraphs(arg)
    updateDatasetMenu(filename)
  }
  // Generate message of file reports for the user
  fileMsg(result, filename, arg)
  // Check if we got results for all files to turn off the spinner
  filesToProccess--
  if (filesToProccess === 0) {
    hideSpinner()
  }
}

// Utility function to hide button in the section with file reports
function hideFileButton() {
  let button_div = document.getElementById("ok-message-file").parentNode
  button_div.classList.remove("d-flex")
  button_div.classList.add("d-none")
}

// This function generates file reports
function fileMsg(result, filename, errMsg) {
  console.log()
  // Checking that we are in the right section
  if (settings.get("section") === "open-file-section-container") {

    // Generate messages
    let container = document.getElementById("message-file")
    let msg, bgcolor
    if (typeof errMsg !== "string") {
      msg = "File '" + filename + "' has been loaded."
      bgcolor = "bg-success"
    } else {
      msg = "Error in file '" + filename + "': " + errMsg +"."
      bgcolor = "bg-danger"
    }
    let text = document.createTextNode(msg)
    let h6 = createElement("h6", ["card-title", "text-white", "my-2", "ml-2"])
    h6.appendChild(text)

    // Generate close buttons
    let icon = document.createTextNode("x")
    let unique_id = "message-file-" + (new Date().getTime()) + (new Date().getUTCMilliseconds())
    messages_ids.push(unique_id)
    let link = createElement("a", ["nav-link", "text-white", "h6"], {"href": "#", "id": unique_id})
    link.appendChild(icon)

    // Put them together
    let card = createElement("div", ["d-flex", "flex-row", "card", "justify-content-between", "my-2", bgcolor]) 
    card.appendChild(h6)
    card.appendChild(link)
    container.append(card)

    // Add event listener for the close button
    document.body.addEventListener("click", (event) => {
      // Remove card
      if (event.target.id && messages_ids.includes(event.target.id)) {
        let card = event.target.parentNode
        card.remove()
        // Check if this was the last card
        let card_div = document.getElementById("message-file")
        if (!card_div.firstChild) {
          // Hide the button
          hideFileButton()
        }
      }
    })

    // Create button if needed
    let button_div = document.getElementById("ok-message-file").parentNode
    if (Array.from(button_div.classList).includes("d-none")) {
      button_div.classList.remove("d-none")
      button_div.classList.add("d-flex")
    }
  }
}

///////////////////////////////////////////////////////////////////////////////
//                       3. Generation of Data Widgets                       //
///////////////////////////////////////////////////////////////////////////////

// This function finds average and standard deviation of a voltage in a dataset 
function Analysis(dataset) {
  let V = dataset.V
  let sum = (arr) => arr.reduce((x, y) => y = y + x)

  // Average
  let average = sum(V) / V.length

  // Standard deviation
  let std = (sum(V.map(x => (x - average) ** 2)) / (V.length - 1)) ** 0.5

  return {"Average voltage": average, "Standard deviation of the voltage": std}
}

// This function generates tables with raw data from the file
function generateDatasetTable(inds) {
  let container = document.getElementById("raw-data-table")
  let datasets = settings.get("datasets")

  // Generate a table for each dataset
  inds.forEach(ind =>{
    let dataset = datasets[ind]
    let id = "raw-data-" + ind

    // See if the file was reuploaded and table must be changed with potentially new dataset
    let existing_table = document.getElementById(id)
    if (existing_table !== null) {
      existing_table.remove()
    }

    // Create new table
    let table = createElement("table", ["d-none", "table", "table-striped", "table-sm"], {"id": id})
    let thead = createElement("thead")
    let tr = createElement("tr");
    ["#", "Time (s)", "Voltage (mV)"].forEach(header => {
      let th = createElement("th")
      let text = document.createTextNode(header)
      th.appendChild(text)
      tr.appendChild(th)
    })
    thead.appendChild(tr)
    table.appendChild(thead)
    let tbody = createElement("tbody")
    for (let i = 0; i < dataset.time.length; i++) {
      let tr = createElement("tr");
      [i + 1, dataset.time[i], dataset.V[i]].forEach(value => {
        let th = createElement("th")
        let text = document.createTextNode(value)
        th.appendChild(text)
        tr.appendChild(th)
      })
      tbody.appendChild(tr)
    }
    table.appendChild(tbody)

    
    // Put table in place and save its id to the settings
    container.appendChild(table)
    dataset["table"] = id
    datasets[ind] = dataset
  })
  // Update settings
  settings.set("datasets", datasets)
}


// This function generates graphics and statistics for datasets from a file
function generateDatasetGraphs(inds) {
  let container = document.getElementById("graphs-section-container")
  let datasets = settings.get("datasets")

  // Generate graph and statistics for each dataset
  inds.forEach(ind =>{
    let dataset = datasets[ind]
    let idCanvas = "chart-data-" + ind

    // See if the file was reuploaded and canvas must be changed with potentially new dataset
    let existing_canvas = document.getElementById(idCanvas)
    if (existing_canvas !== null) {
      existing_canvas.remove()
    }

    let canvas = createElement("canvas", ["d-none", "my-4", "w-100"], {id: idCanvas, width: "900", height: "300"})

    // Graph
    var myLineChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: dataset.time,
        datasets: [{
          data: dataset.V,
          pointRadius: 0,
          borderWidth: 1,
          borderColor: "#007bff",
          fill: false,
          lineTension: 0
        }]
      },
      options: {
        legend: {
          display: false
        },
        scales: {
          xAxes: [{
            scaleLabel: {
              display: true,
              labelString: "Time (s)",
              autoSkip: true,
              maxTicksLimit: 10
            }
          }],
          yAxes: [{
            scaleLabel: {
              display: true,
              labelString: "Voltage (mV)"
            }
          }]
        }
      }
    })

    
    idCard = "stat-data-" + ind
    // See if the file was reuploaded and statistics must be changed with potentially new dataset
    let existing_card = document.getElementById(idCard)
    if (existing_card !== null) {
      existing_card.remove()
    }

    // Statistics
    stats = Analysis(dataset)
    let card = createElement("div", ["d-none", "card"], {id: idCard})
    let cardHeader = createElement("div", ["card-header"])
    let textHeader = document.createTextNode("Statistics")
    cardHeader.appendChild(textHeader)
    card.appendChild(cardHeader)

    Object.keys(stats).forEach((stat) => {
      let cardBody = createElement("div", ["card-body"])
      let textBody = document.createTextNode(stat + " = " + stats[stat] + " mV")
      cardBody.appendChild(textBody)
      card.appendChild(cardBody)
    }) 

    // Put table in place and save its id to the settings 
    container.appendChild(canvas)
    container.appendChild(card)
    dataset["chart"] = idCanvas
    dataset["stat"] = idCard
    datasets[ind] = dataset
  })
  // Update settings
  settings.set("datasets", datasets)
}
