const toolbar = document.getElementById("toolbar");
const colorPanel = document.getElementById("color-panel");
const canvas = document.getElementById('drawing-canvas');
const ctx = canvas.getContext('2d');
const width = canvas.width;
const height = canvas.height;
const startPromptInput = document.getElementById("phrase-input");
const startSubmitBtn = document.getElementById("start-submit-btn");

const tools = {
    pen: {
        name: "pen",
        selectable: true,
        icon: "bi-brush-fill",
        fill: "#FFFFFFFF",
        tools: ["fill"]
    },
    bucket: {
        name: "bucket",
        selectable: true,
        icon: "bi-paint-bucket",
        fill: "#FFFFFFFF",
        tools: ["fill"]
    },
    eraser: {
        name: "eraser",
        selectable: true,
        icon: "bi-eraser-fill",
        tools: []
    },
    polygon: {
        name: "polygon",
        selectable: true,
        icon: "bi-bounding-box-circles",
        stroke: "#FFFFFFFF",
        fill: "#FFFFFF00",
        tools: ["stroke", "fill"]
    },
    undo: {
        name: "undo",
        selectable: false,
        icon: "bi-arrow-counterclockwise"
    },
    redo: {
        name: "redo",
        selectable: false,
        icon: "bi-arrow-clockwise"
    }
};

const defaultColors = [
    "#FFFFFFFF", "#000000FF",
    "#FF0000FF", "#00FF00FF",
    "#0000FFFF", "#FFFF00FF",
    "#FF00FFFF", "#00FFFFFF",
    "#aaaaaaFF", "#8D6F64FF"
]

defaultColors.forEach((color) => {
    colorPanel.insertAdjacentHTML("beforeend", `<div class="color-option" data-color="${color}" style="--color:${color}"></div>`)
})

// init tools
Object.keys(tools).forEach((key) => {
    const tool = tools[key];
    toolbar.insertAdjacentHTML("beforeend", `<div class="draw-tool ${tool.selectable ? "selectable-tool" : ""}" id="${tool.name}-tool" data-tool="${tool.name}">
                <i class="bi ${tool.icon}"></i>
            </div>`);
});
const selectableTools = document.querySelectorAll('.selectable-tool');

if (selectableTools.length > 0) {
    selectableTools[0].classList.add("selected-tool");
}



class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.visible = true;
    }
}

let painting = false;
let currentPath = null;
let currentTool = 'pen';

let actions = [];
let viewActionIndex = -1;
let contextMenu = false;
let lastMousePos = new Point(0, 0);


class Path {
    constructor(color, thickness) {
        this.color = color;
        this.thinkness = thickness;
        this.points = [];
    }

    draw(context) { }

    addPoint(point) {
        this.points.push(point);
    }
}

class BrushPath extends Path {
    constructor(color, thickness) {
        super(color, thickness);
    }

    draw(context) {
        if (this.points.length == 0) return;
        context.beginPath();
        context.lineCap = 'round';
        context.beginPath();
        context.strokeStyle = this.color;
        context.lineWidth = this.thinkness;
        context.globalCompositeOperation = 'source-over';
        context.moveTo(this.points[0].x, this.points[0].y);
        this.points.forEach((point, index) => {
            context.lineTo(point.x, point.y);
            context.moveTo(point.x, point.y);
        });
        context.stroke();
    }
}

class EraserPath extends Path {
    constructor(thickness) {
        super('#FFFFFFFF', thickness);
    }

    draw(context) {
        if (this.points.length == 0) return;
        context.beginPath();
        context.beginPath();
        context.lineCap = 'round';
        context.strokeStyle = this.color;
        context.lineWidth = this.thinkness;
        context.globalCompositeOperation = 'destination-out';
        context.moveTo(this.points[0].x, this.points[0].y);
        this.points.forEach((point, index) => {
            context.lineTo(point.x, point.y);
            context.moveTo(point.x, point.y);
        });
        context.stroke();
    }
}

class ClearPath {
    draw(context) {
        clearCanvas();
    }
}

class BucketPath {
    constructor(imageData, x, y, targetColor, fillColor) {
        this.imageData = imageData;
        this.x = x;
        this.y = y;
        this.targetColor = targetColor;
        this.fillColor = fillColor;
    }

    draw(context) {
        context.putImageData(this.imageData, 0, 0);
    }

    drawAction(context) {
        floodFill(this.imageData, this.x, this.y, this.targetColor, this.fillColor);
    }
}

class PolygonPath extends Path {
    constructor(color, thinkess) {
        super(color, thinkess);
    }

    draw(context) {
        if (this.points.length == 0) return;
        context.beginPath();
        context.lineCap = 'round';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.thinkness;
        ctx.drawingMode = 'source-over';
        context.moveTo(this.points[0].x, this.points[0].y);
        this.points.forEach((point, index) => {
            context.lineTo(point.x, point.y);
            context.moveTo(point.x, point.y);
        });
        context.lineTo(this.points[0].x, this.points[0].y);
        context.stroke();
    }

    drawWithPoint(context, point) {
        let modifiedPoints = [...this.points, point];
        if (modifiedPoints.length == 0) return;
        context.beginPath();
        context.lineCap = 'round';
        ctx.strokeStyle = this.color;
        ctx.lineWidth = this.thinkness;
        ctx.drawingMode = 'source-over';
        context.moveTo(modifiedPoints[0].x, modifiedPoints[0].y);
        modifiedPoints.forEach((point, index) => {
            context.lineTo(point.x, point.y);
            context.moveTo(point.x, point.y);
        });
        context.lineTo(modifiedPoints[0].x, modifiedPoints[0].y);
        context.stroke();
    }
}

// event listeners
canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    contextMenu = true;
    rightClickHandler(event);
    draw(event);
});
canvas.addEventListener('click', (event) => {
    clickHandler(event);
});
canvas.addEventListener('mousedown', startPosition);
canvas.addEventListener('mouseup', endPosition);
canvas.addEventListener('mouseleave', endPosition);
canvas.addEventListener('mousemove', draw);

selectableTools.forEach(tool => tool.addEventListener('click', switchTool));

document.getElementById('clearBtn').addEventListener('click', () => {
    appendAction(new ClearPath());
    paintCanvas();
});

document.getElementById('undo-tool').addEventListener('click', () => undo());
document.getElementById('redo-tool').addEventListener('click', () => redo());

document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && event.key === 'z') {
        event.preventDefault();
        undo();
    }
    if (event.ctrlKey && event.key === 'y') {
        event.preventDefault();
        redo();
    }
});

startPromptInput.addEventListener('input', function () {
    startSubmitBtn.disabled = this.value.trim().length < 5;
});

startSubmitBtn.addEventListener('click', function () {
    const phrase = startSubmitBtn.value.trim();
    console.log(phrase);
    startSubmitBtn.disabled = true;
    startPromptInput.disabled = true;
    startSubmitBtn.innerHTML = "Submited";
    // switch sections
})

// drawing function functionalities

function appendAction(action) {
    // if we are not at the end of the action list, remove all actions after the current index
    if (viewActionIndex < actions.length - 1) {
        actions = actions.slice(0, viewActionIndex + 1);
    }
    actions.push(action);
    viewActionIndex++;
}

function startPosition(e) {
    painting = true;
    if (currentTool == 'pen')
        currentPath = new BrushPath(getBrushColor(), getBrushWidth());
    else if (currentTool == 'eraser')
        currentPath = new EraserPath(getBrushWidth());
    draw(e);
}

function endPosition(e) {
    painting = false;
    if (!contextMenu) {
        if (currentTool == 'pen' || currentTool == 'eraser') {
            if (currentPath) {
                appendAction(currentPath);
                currentPath = null;
            }
            ctx.beginPath();
        }
    }

    contextMenu = false;
    paintCanvas();
}

function clickHandler(e) {
    if (currentTool == 'polygon') {
        if (currentPath == null) {
            currentPath = new PolygonPath(getBrushColor(), getBrushWidth());
            currentPath.addPoint(getMousePos(e));
        }
        else {
            currentPath.addPoint(getMousePos(e));
        }
    }
    else if (currentTool == 'bucket') {
        let imageData = ctx.getImageData(0, 0, width, height);
        const origin = getMousePos(e);
        const targetColor = getPixelColor(imageData, origin.x, origin.y);
        const fillColor = hexToRgb(getBrushColor());
        floodFill(imageData, origin.x, origin.y, targetColor, fillColor);
        ctx.putImageData(imageData, 0, 0);
        appendAction(new BucketPath(imageData, origin.x, origin.y, targetColor, fillColor));
    }
}

function rightClickHandler(e) {
    if (currentTool == 'polygon') {
        currentPath.addPoint(getMousePos(e));
        appendAction(currentPath);
        currentPath = null;
    }
}

function getBrushWidth() {
    return document.getElementById('brushSize').value;
}

function getBrushColor() {
    return document.getElementById('colorPicker').value;
}

function getMousePos(e) {
    return new Point(e.clientX - canvas.offsetLeft, e.clientY - canvas.offsetTop);
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function draw(e) {
    lastMousePos = getMousePos(e);
    if ((currentTool == 'pen' || currentTool == 'erase') && !painting) return;
    ctx.lineWidth = getBrushWidth();
    ctx.lineCap = 'round';
    ctx.strokeStyle = getBrushColor();

    // ctx.lineTo(e.clientX - canvas.offsetLeft, e.clientY - canvas.offsetTop);
    // ctx.stroke();
    // ctx.beginPath();
    // ctx.moveTo(e.clientX - canvas.offsetLeft, e.clientY - canvas.offsetTop);

    paintCanvas();

    // path stuff
    if ((currentTool == 'pen' || currentTool == 'eraser') && currentPath) {
        currentPath.addPoint(getMousePos(e));
    }
}

function paintCanvas() {
    clearCanvas();
    for (let i = 0; i < viewActionIndex + 1; i++) {
        if (actions[i])
            actions[i].draw(ctx);
    }

    if ((currentTool == 'pen' || currentTool == 'eraser') && currentPath) {
        currentPath.draw(ctx);
    }
    else if (currentTool == 'polygon' && currentPath) {
        currentPath.drawWithPoint(ctx, lastMousePos);
    }
}

function switchTool(e) {
    if (currentTool == 'polygon') currentPath = null;
    currentTool = this.getAttribute('data-tool');
    selectableTools.forEach(tool => tool.classList.remove('selected-tool'));
    this.classList.add('selected-tool');
    paintCanvas();
}

function getPixelColor(imageData, x, y) {
    const index = (y * imageData.width + x) * 4;
    return {
        r: imageData.data[index],
        g: imageData.data[index + 1],
        b: imageData.data[index + 2],
        a: imageData.data[index + 3]
    };
}

function hexToRgb(hex) {
    if (hex.length < 8) hex += 'FF';
    const bigint = parseInt(hex.slice(1), 16);
    return {
        r: (bigint >> 24) & 255,
        g: (bigint >> 16) & 255,
        b: (bigint >> 8) & 255,
        a: bigint & 255
    };
}

function colorsEqual(c1, c2) {
    return c1.r === c2.r && c1.g === c2.g && c1.b === c2.b && c1.a === c2.a;
}

function floodFill(imageData, x, y, targetColor, fillColor) {
    if (colorsEqual(targetColor, fillColor)) return;
    const width = imageData.width;
    const height = imageData.height;
    const stack = [];
    stack.push({ x, y });
    while (stack.length > 0) {
        const { x, y } = stack.pop();
        const index = (y * width + x) * 4;
        const currentColor = {
            r: imageData.data[index],
            g: imageData.data[index + 1],
            b: imageData.data[index + 2],
            a: imageData.data[index + 3]
        };
        if (colorsEqual(currentColor, targetColor)) {
            imageData.data[index] = fillColor.r;
            imageData.data[index + 1] = fillColor.g;
            imageData.data[index + 2] = fillColor.b;
            imageData.data[index + 3] = fillColor.a;
            if (x + 1 < width) stack.push({ x: x + 1, y });
            if (x - 1 >= 0) stack.push({ x: x - 1, y });
            if (y + 1 < height) stack.push({ x, y: y + 1 });
            if (y - 1 >= 0) stack.push({ x, y: y - 1 });
        }
    }
}

function undo() {
    if (viewActionIndex >= 0) {
        if (currentPath == null) viewActionIndex--;
        else {
            if (currentTool == 'polygon') {
                currentPath.points.pop();
            }
            else if (currentTool == 'pen' || currentTool == 'eraser') {
                currentPath == null;
            }
        }
        paintCanvas();
    }
}

function redo() {
    if (viewActionIndex < actions.length - 1) {
        viewActionIndex++;
        paintCanvas();
    }
}
