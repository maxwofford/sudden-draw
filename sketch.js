// session state
var paint, isShiftPressed, mouseX, mouseY, unexportedChanges, hidden = true

document.addEventListener('keydown', e => {
  if (e.key === 'Shift') {
    isShiftPressed = true
    redraw()
  }
})
document.addEventListener('keyup', e => {
  if (e.key === 'Shift') {
    isShiftPressed = false
    redraw()
  }
})

// persistent state
function getMemory() {
  return JSON.parse(localStorage.getItem('sketch'))
}
function setMemory(key, value) {
  const memory = getMemory()
  memory[key] = value

  return localStorage.setItem('sketch', JSON.stringify(memory))
}
function getClicks() {
  const memory = getMemory()
  return memory.layers[memory.activeLayerIndex] || []
}
function setClicks(clicks) {
  // sets the clicks of the active layer
  const memory = getMemory()
  memory.layers[memory.activeLayerIndex] = clicks
  setMemory('layers', memory.layers)
  unexportedChanges = true
}
function changeActiveLayer(change) {
  const memory = getMemory()
  setMemory('activeLayerIndex', Math.max(0, memory.activeLayerIndex + change))
  redraw()
}
function initMemory() {
  const defaults = {
    scaling: 1, // increase to get a more pixelated effect
    resolution: 1, // ignore movements that are smaller than this distance (to speed up rendering)
    canvasWidth: 256 * 3,
    canvasHeight: 256 * 3,
    drawColor: '#ec3750',
    backgroundColor: 'white',
    layers: [],
    activeLayerIndex: 0,
    size: 25,
    ghostColor: 'grey', // color of mouse cursor
  }
  localStorage.setItem('sketch', JSON.stringify(defaults))

  if (context != undefined) {
    redraw()
  }
}

if (!getMemory()) {
  initMemory()
}

// Initialization
const canvasDiv = document.querySelector('#canvasDiv')
canvas = document.createElement('canvas')
canvas.setAttribute('width', getMemory().canvasWidth)
canvas.setAttribute('height', getMemory().canvasHeight)
canvas.setAttribute('id', 'canvas')
const pixelation = 'image-rendering: crisp-edges; image-rendering: pixelated;'
const borders = 'border: 1px solid black;'
canvas.setAttribute('style', `${pixelation} ${borders} width: ${getMemory().canvasWidth * getMemory().scaling}px; height: ${getMemory().canvasHeight * getMemory().scaling}px;`)
canvasDiv.appendChild(canvas)
if (typeof G_vmlCanvasManager != 'undefined') {
  canvas = G_vmlCanvasManager.initElement(canvas)
}
context = canvas.getContext('2d')

// Buttons & tools
document.querySelector('#sizePicker').value = getMemory().size
document.querySelector('#sizePreview').style.height = `${getMemory().size * getMemory().scaling}px`
document.querySelector('#sizePreview').style.width = `${getMemory().size * getMemory().scaling}px`
console.log(document.querySelector('#sizePreview'))
document.querySelector('#sizePicker').addEventListener('input', e => {
  setMemory('size', e.target.value)
  document.querySelector('#sizePreview').style.height = `${getMemory().size * getMemory().scaling}px`
  document.querySelector('#sizePreview').style.width = `${getMemory().size * getMemory().scaling}px`
})
document.querySelector('#colorPicker').value = getMemory().drawColor
document.querySelector('#colorPicker').addEventListener('input', e => {
  setMemory('drawColor', e.target.value)
})
// document.querySelector('#drawButton').addEventListener('click', e => {
//   setMemory('size', 4)
//   setMemory('color', getMemory().drawColor)
// })
// document.querySelector('#eraseButton').addEventListener('click', e => {
//   setMemory('color', getMemory().backgroundColor)
// })
function undo() {
  const clicks = getClicks()
  const doneClicks = clicks.filter(click => !click.undone)
  if (doneClicks.length > 0) {
    doneClicks[doneClicks.length - 1].undone = true
    setClicks(clicks)
    redraw()
  }
}
document.querySelector('#saveButton').addEventListener('click', e => {
  const name = getMemory().name || prompt('enter your name')
  if (!name) {
    return
  }
  if (!getMemory().name) {
    setMemory('name', name)
  }

  canvas.toBlob(blob => {
    let safeFileName = `${name}`.replace(/[^\w+]/g, '_')

    saveAs(blob, safeFileName + '.png')
  })
})
function exportToAirtable(final = 0) {
  const name = getMemory().name || prompt('enter your name')
  if (!name) {
    return
  }
  if (!getMemory().name) {
    setMemory('name', name)
  }

  const dataURL = canvas.toDataURL()
  const zapierURL = 'https://hooks.zapier.com/hooks/catch/507705/o5uvtyq/'
  fetch(zapierURL, {
    method: 'POST',
    body: JSON.stringify({
      name: name,
      dataURL: dataURL,
      finalSubmission: final
    })
  }).then(res => {
    console.log('submitted!')
    if (final == 1) {
      unexportedChanges = false
      alert('Sent to Airtable!')
    }
  })
}
document.querySelector('#exportButton').addEventListener('click', e => {
  exportToAirtable(1)
})
document.querySelector('#hideButton').addEventListener('click', e => {
  hidden = !hidden
  redraw(true)
})
document.querySelector('#forgetButton').addEventListener('click', e => {
  if (confirm('Anything not saved will be lost...')) {
    localStorage.removeItem('sketch')
    initMemory()
  }
})
document.querySelector('#undoButton').addEventListener('click', e => {
  undo()
})
function redo() {
  const clicks = getClicks()
  const recentUndoneClick = clicks.find(click => click.undone)
  if (recentUndoneClick) {
    recentUndoneClick.undone = false
    setClicks(clicks)
    redraw()
  }
}
document.querySelector('#redoButton').addEventListener('click', e => {
  redo()
})

document.addEventListener('keypress', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
    e.preventDefault()

    undo()
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
    e.preventDefault()

    redo()
  }
  if (e.key === 'e') {
    e.preventDefault()

    changeActiveLayer(1)
  }
  if (e.key === 'q') {
    e.preventDefault()

    changeActiveLayer(-1)
  }
  if (e.key === 'l') {
    e.preventDefault()

    setMemory('looping', !getMemory().looping)
  }
})

// sketching
function addClick(x, y, dragging) {
  // when we start clicking, we'll delete the "undone" history for good
  const clicks = getClicks().filter(click => !click.undone)

  // if we're close to the previous point, just ignore it
  const lastClick = clicks[clicks.length - 1]
  const lastPoint = lastClick?.points[lastClick.points.length -1]
  const {
    resolution,
    scaling
  } = getMemory()
  if (lastPoint && Math.abs(x-lastPoint.x*scaling)<resolution && Math.abs(y-lastPoint.y*scaling)<resolution) {
    return
  }

  if (dragging) {
    if (isShiftPressed && lastClick.points.length > 1) {
      // get the last click and add the coordinate
      lastClick.points[lastClick.points.length - 1].x = x
      lastClick.points[lastClick.points.length - 1].y = y
    } else {
      // get the last click and add the coordinate
      lastClick.points.push({x, y})
    }
  } else {
    // create a new click
    const { size, drawColor } = getMemory()
    clicks.push({
      size: size,
      color: drawColor,
      points: [ {x, y} ],
    })
  }
  setClicks(clicks)
}

function drawClick(click) {
  context.beginPath()
  if (click.shiftPressed) {
    const point = click.points[0]
    const endpoint = click.points[Math.max(0, click.points.length - 1)]
    context.moveTo(point.x, point.y)
    context.lineTo(endpoint.x, endpoint.y)
    context.lineCap = 'round'
    context.strokeStyle = click.color
    context.lineWidth = click.size
    context.stroke()
  } else {
    for (let i = 0; i < click.points.length; i++) {
      let point = click.points[i]
      let prevPoint = click.points[i - 1]
      if (prevPoint) {
        context.moveTo(prevPoint.x, prevPoint.y)
      } else {
        context.moveTo(point.x - 1, point.y)
      }
      context.lineTo(point.x, point.y)
      context.strokeStyle = click.color
      context.lineWidth = click.size
      context.lineCap = 'round'
      context.stroke()
    }
  }
  context.closePath()
}

function redraw(fullRedraw = true) {
  const memory = getMemory()
  const shownClicks = getClicks().filter(clicks => !clicks.undone)
  if (hidden) {
    context.fillStyle = memory.backgroundColor
    // context.filter('blur(50px)')
    context.fillRect(0, 0, context.canvas.width, context.canvas.height)
    const lastClick = shownClicks[shownClicks.length - 1]
    if (isShiftPressed) {
      drawClick(lastClick)
    } else {
      drawClick({
        ...lastClick,
        points: [...lastClick.points.slice(-20)]
      })
    }
  } else {
    // draw clicks on page
    if (fullRedraw) {
      context.fillStyle = memory.backgroundColor
      context.fillRect(0, 0, context.canvas.width, context.canvas.height)
      shownClicks.forEach(drawClick)
    } else {
      const lastClick = shownClicks[shownClicks.length - 1]
      if (isShiftPressed) {
        drawClick(lastClick)
      } else {
        drawClick({
          ...lastClick,
          points: [...lastClick.points.slice(-2)]
        })
      }
    }
  }
}

function clickStart(event) {
  event.preventDefault()
  const { scaling } = getMemory()
  mouseX = (event.pageX - canvas.offsetLeft) / scaling
  mouseY = (event.pageY - canvas.offsetTop) / scaling
  addClick(mouseX, mouseY, false)
  paint = true
  redraw(false)
}

canvas.addEventListener('mousedown', e => {
  clickStart(e)
})
canvas.addEventListener('touchstart', e => {
  clickStart(e)
})

function clickDrag(event) {
  event.preventDefault()
  const { scaling } = getMemory()
  mouseX = (event.pageX - canvas.offsetLeft) / scaling
  mouseY = (event.pageY - canvas.offsetTop) / scaling
  if (paint) {
    addClick(mouseX, mouseY, true)
    if (isShiftPressed) {
      redraw(true)
    } else {
      redraw(false)
    }
  }
}
canvas.addEventListener('mousemove', e => {
  clickDrag(e)
})
canvas.addEventListener('touchmove', e => {
  clickDrag(e)
})

function clickStop() {
  paint = false
  redraw()
}
canvas.addEventListener('mouseup', e => {
  clickStop()
})
canvas.addEventListener('mouseleave', e => {
  clickStop()
})
canvas.addEventListener('touchstop', e => {
  clickStop()
})
canvas.addEventListener('touchcancel', e => {
  clickStop()
})

// tooltips
function genTooltip(id, image, description='') {
  tippy(`#${id}`, {
    content: `<div style="max-width: 300px;"><img src="${image}" style="max-width: 100%;" /><p style="font-weight: 500; font-family: system-ui;">${description}</p></div>`,
    delay: [500, 0],
    followCursor: 'horizontal',
    placement: 'bottom'
  })
}
// genTooltip('sizePickerField', 'save-button.gif', 'Saves the drawing to your computer. <span style="color: #ff6700; font-weight: bold;">This will not save your dino on this website.</style>')
// genTooltip('thinButton', 'thin-button.gif', 'Draw a <span style="font-weight: 100;">thin</span> black line')
// genTooltip('thickButton', 'thick-button.gif', 'Draw a <span style="font-weight: 800;">thick</span> black line')
// genTooltip('templateButton', 'template-button.gif', 'Show a dino outline you can use as a starting point. You can toggle it on and off anytime.')
// genTooltip('eraseButton', 'erase-button.gif', 'Draw with a <span style="background: white; color: black; border-radius: 5px;">white</span> marker to erase mistakes or cut out black parts of an image. Also covers the dino template.')
genTooltip('exportButton', 'export-button.gif', '<strong>UPLOAD:</strong>Gurgles the bits and spits \'em out into the tubes of light connecting the world. <span style="color: #ff6700; font-weight: bold;">We aren\'t responsible for the voilence causes by videogames running on the web.</span>')
genTooltip('redoButton', 'redo-button.gif', '<strong>REDO:</strong> Every press goes <em>forward</em> by a step. <em>Doesn\'t go to the future, just the present.</em>')
genTooltip('undoButton', 'undo-button.gif', '<strong>UNDO:</strong> Every press goes <em>back</em> by a step.')
genTooltip('saveButton', 'save-button.gif', '<strong>DLOAD:</strong><span style="color: #00ff67; font-weight: bold;">Save and download</span> the drawing to your computer.')
genTooltip('timerHolder', 'deadline-button.gif', 'Toggle the deadline visibility. <em>⚠️ Despite appearances, time will continue to flow</em>.')

redraw()