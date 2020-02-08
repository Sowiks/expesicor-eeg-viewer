const path = require("path")
const fs = require("fs")
const { app, BrowserWindow, dialog, ipcMain, Menu } = require("electron")
const settings = require("electron-settings")

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win
let menu

function createWindow () {
    // Create the browser window.
    win = new BrowserWindow({
        width: 1280,
        height: 960,
        webPreferences: {
          nodeIntegration: true
        },
    })

    // Delete default menu
    const template = []
    menu = Menu.buildFromTemplate(template)
    Menu.setApplicationMenu(menu)

    // Delete all previous settings
    settings.deleteAll()
    // Define menu 
    settings.set("navigation", [
          {
            "name": "Open Files",
            "data": ["data-section", "open-file-section-container"],
            "feather": "upload",
            "active": true
          },
          {
            "name": "Data and Analysis",
            "data": ["data-section", "graphs-section-container"],
            "feather": "activity",
            "active": false
          },
          {
            "name": "Raw Data",
            "data": ["data-section", "raw-data-section-container"],
            "feather": "file-text",
            "active": false
          }])

    // Will use settings to store variables across scripts
    settings.set("section", settings.get("navigation")[0].data[1])
    settings.set("datasets", [])
    
    // Load template
    const htmlPath = path.join("renderer", "index.html")
    win.loadFile(htmlPath)
    
    // Emitted when the window is closed.
    win.on("closed", () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
    })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow)

// Quit when all windows are closed.
app.on("window-all-closed", () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== "darwin") {
    app.quit()
    }
})

app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
    createWindow()
    }
})


// Event listener to open browser to upload files
ipcMain.on("openFiles", (event) => {
  dialog.showOpenDialog(win, {
    properties: ["openFile", "multiSelections"],
    filters: [{ name: "EEG data", extensions: ["txt"]}]
  }).then((result) => {
    if (result.filePaths.length > 0){
      win.webContents.send("loading", result.filePaths.length)
      result.filePaths.forEach(parseFile)
    }
  })
})

// Event listener to upload files if they are dragged
ipcMain.on("uploadFiles", (event, filePaths) => {
  win.webContents.send("loading", filePaths.length)
  filePaths.forEach(parseFile)
})

// Parse file
function parseFile(filePath) {
  // get the filename from its full path
  let filename = filePath.replace(/^.*[\\\/]/, "")
  try {
    // Open file
    fileContent = fs.readFileSync(filePath, "utf-8").toString()
    // Split by newlines
    rows = fileContent.split(/[\r\n]+/).filter(Boolean)
    
    let data = []
    let columns = 0
    rows.forEach((row, i) => {
      // Convert line to array of numbers
      let numbers = row.trim().split(/[ \t]+/).map(s => {
        if (isNaN(s)) {
          // Cannot convert string to number
          throw (s + " is not a number (line " + (i + 1) + ")")
        } else {
          return parseFloat(s)
        }
      })

      // When i=0, define data as an array [[], [], ..., []] according to the number of columns
      if (!columns && numbers.length) {
        columns = numbers.length
        data = [...Array(columns)].map(e => [])
      }

      // Check that number of columns is consistent throught the file
      if (columns < 2) {
        throw ("Must be at least two columns (line " + (i + 1) + ")")
      }
      if (columns != numbers.length) {
        throw ("Must be the same number of columns thought the file (lines " + i + " and " + (i + 1) + ")")
      }

      // Add data
      for (let j=0; j < data.length; j++) {
        data[j].push(numbers[j])
      }
    })

    // Will store data to settings
    let datasets = settings.get("datasets")
    let inds = []
    // Each file can contain more than 2 columns => multiple datasets
    // Go over the columns, starting from the 2nd one
    for (let i=1; i < data.length; i++) {
      // Define a name for a dataset as:
      // filename w/0 extension (# it's column in the file)
      // e.g., "eeg (3)"
      name = filename.match(/.+?(?=(?:\.[^.]*$|$))/) + (i > 1 ? (" (" + i + ")") : "")
      // The structure of a dataset
      let obj = {
        name: name,
        time: data[0],
        V: data[i]
      }
      // If file with the same name is uploaded, override corresponding datasets
      j = datasets.findIndex(ds => ds["name"] === name)
      if (j == -1) {
        datasets.push(obj)
        inds.push(datasets.length - 1)
      } else {
        datasets[j] = obj
        inds.push(j)
      }
    }
    // Save all datasets into settings
    settings.set("datasets", datasets)
    // Send event that files are succesfully parsed
    win.webContents.send("finishedFile", filename, inds)
  }
  catch(errMsg) {
    // Send error event
    win.webContents.send("errorFile", filename, errMsg)
  }
}
