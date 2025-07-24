class ImageCropper {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.options = { ...{ width: 400, height: 400, aspectRatio: null }, ...options };

        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;

        this.image = null;
        this.rotation = 0;
        this.scale = 1;
        this.imageOffset = { x: 0, y: 0 };

        this.cropBox = null;
        this.action = 'none';
        this.dragStart = { x: 0, y: 0 };
        this.resizeHandleSize = 10; // Slightly larger for touch
        this.selectedHandle = null;

        this.init();
    }

    init() {
        // Mouse Events
        this.canvas.addEventListener('mousedown', this.onActionStart.bind(this));
        this.canvas.addEventListener('mousemove', this.onActionMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onActionEnd.bind(this));
        this.canvas.addEventListener('mouseout', this.onActionEnd.bind(this));

        // Touch Events
        this.canvas.addEventListener('touchstart', this.onActionStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.onActionMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.onActionEnd.bind(this));
        this.canvas.addEventListener('touchcancel', this.onActionEnd.bind(this));
    }

    loadImage(imageSrc) {
        this.image = new Image();
        this.image.onload = () => {
            this.rotation = 0;
            this.cropBox = null;
            this.updateCanvas();
        };
        this.image.src = imageSrc;
    }

    updateCanvas() {
        if (!this.image) return;
        this.scale = Math.min(this.canvas.width / this.image.width, this.canvas.height / this.image.height);
        const scaledWidth = this.image.width * this.scale;
        const scaledHeight = this.image.height * this.scale;
        this.imageOffset.x = (this.canvas.width - scaledWidth) / 2;
        this.imageOffset.y = (this.canvas.height - scaledHeight) / 2;
        this.redraw();
    }

    redraw() {
        if (!this.image) return; // Prevent drawing if no image is loaded
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawImage();
        if (this.cropBox) {
            this.drawCropBox();
        }
    }

    drawImage() {
        if (!this.image) return; // Prevent drawing if no image is loaded
        this.ctx.save();
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.rotate(this.rotation * Math.PI / 180);
        this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
        this.ctx.drawImage(this.image, this.imageOffset.x, this.imageOffset.y, this.image.width * this.scale, this.image.height * this.scale);
        this.ctx.restore();
    }

    rotate() {
        if (!this.image) return; // Prevent rotating if no image is loaded
        if (this.cropBox) {
            const center = { x: this.canvas.width / 2, y: this.canvas.height / 2 };
            const cropCenter = { x: this.cropBox.x + this.cropBox.width / 2, y: this.cropBox.y + this.cropBox.height / 2 };
            const translated = { x: cropCenter.x - center.x, y: cropCenter.y - center.y };
            const rotated = { x: -translated.y, y: translated.x };
            const newCropCenter = { x: rotated.x + center.x, y: rotated.y + center.y };
            const newWidth = this.cropBox.height;
            const newHeight = this.cropBox.width;
            this.cropBox = { x: newCropCenter.x - newWidth / 2, y: newCropCenter.y - newHeight / 2, width: newWidth, height: newHeight };
        }
        this.rotation = (this.rotation + 90) % 360;
        this.redraw();
    }

    getImageBoundingBox() {
        if (!this.image) return { x: 0, y: 0, width: this.canvas.width, height: this.canvas.height };
        const w = this.image.width * this.scale;
        const h = this.image.height * this.scale;
        const x = this.imageOffset.x;
        const y = this.imageOffset.y;
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const angle = this.rotation * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const corners = [{ x: x, y: y }, { x: x + w, y: y }, { x: x + w, y: y + h }, { x: x, y: y + h }];
        const rotatedCorners = corners.map(p => {
            const translatedX = p.x - cx;
            const translatedY = p.y - cy;
            return { x: translatedX * cos - translatedY * sin + cx, y: translatedX * sin + translatedY * cos + cy };
        });
        const minX = Math.min(...rotatedCorners.map(p => p.x));
        const minY = Math.min(...rotatedCorners.map(p => p.y));
        const maxX = Math.max(...rotatedCorners.map(p => p.x));
        const maxY = Math.max(...rotatedCorners.map(p => p.y));
        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }

    getEventPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.type.startsWith('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.startsWith('touch') ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    onActionStart(e) {
        e.preventDefault();
        const pos = this.getEventPos(e);
        const bounds = this.getImageBoundingBox();
        if (pos.x < bounds.x || pos.x > bounds.x + bounds.width || pos.y < bounds.y || pos.y > bounds.y + bounds.height) return;

        this.selectedHandle = this.cropBox ? this.getHandleForMousePos(pos) : null;
        if (this.selectedHandle) {
            this.action = 'resizing';
        } else if (this.cropBox && this.isWithinCropBox(pos)) {
            this.action = 'dragging';
        } else {
            this.action = 'drawing';
            this.cropBox = { x: pos.x, y: pos.y, width: 0, height: 0 };
        }
        this.dragStart = pos;
    }

    onActionMove(e) {
        e.preventDefault();
        if (this.action === 'none') {
            this.updateCursor(this.getEventPos(e));
            return;
        }

        const pos = this.getEventPos(e);
        const bounds = this.getImageBoundingBox();
        const clampedPos = {
            x: Math.max(bounds.x, Math.min(pos.x, bounds.x + bounds.width)),
            y: Math.max(bounds.y, Math.min(pos.y, bounds.y + bounds.height))
        };

        if (this.action === 'drawing') {
            let width = clampedPos.x - this.dragStart.x;
            let height = clampedPos.y - this.dragStart.y;
            if (this.options.aspectRatio) {
                const ar = this.options.aspectRatio;
                if (Math.abs(width) > Math.abs(height * ar)) height = width / ar; else width = height * ar;
            }
            this.cropBox.width = width;
            this.cropBox.height = height;
        } else if (this.action === 'dragging') {
            const dx = pos.x - this.dragStart.x;
            const dy = pos.y - this.dragStart.y;
            this.cropBox.x = Math.max(bounds.x, Math.min(this.cropBox.x + dx, bounds.x + bounds.width - this.cropBox.width));
            this.cropBox.y = Math.max(bounds.y, Math.min(this.cropBox.y + dy, bounds.y + bounds.height - this.cropBox.height));
            this.dragStart = pos; // Update dragStart only when dragging
        } else if (this.action === 'resizing') {
            const dx = clampedPos.x - this.dragStart.x;
            const dy = clampedPos.y - this.dragStart.y;
            this.resizeCropBox(dx, dy, bounds);
            this.dragStart = pos; // Update dragStart only when resizing
        }

        this.redraw();
    }

    onActionEnd(e) {
        e.preventDefault();
        if (this.action === 'drawing' && this.cropBox) {
            if (this.cropBox.width < 0) { this.cropBox.x += this.cropBox.width; this.cropBox.width *= -1; }
            if (this.cropBox.height < 0) { this.cropBox.y += this.cropBox.height; this.cropBox.height *= -1; }
        }
        this.action = 'none';
        this.selectedHandle = null;
        this.redraw();
    }

    resizeCropBox(dx, dy, bounds) {
        let { x, y, width, height } = this.cropBox;
        const handle = this.selectedHandle;
        if (this.options.aspectRatio) {
            const ar = this.options.aspectRatio;
            let change = (Math.abs(dx) > Math.abs(dy)) ? dx : dy;
            const widthChange = (handle.includes('l') || handle.includes('t')) ? -change : change;
            const heightChange = widthChange / ar;
            width += widthChange;
            height += heightChange;
            if (handle.includes('l')) x -= widthChange;
            if (handle.includes('t')) y -= heightChange;
        } else {
            if (handle.includes('l')) { width -= dx; x += dx; }
            if (handle.includes('r')) { width += dx; }
            if (handle.includes('t')) { height -= dy; y += dy; }
            if (handle.includes('b')) { height += dy; }
        }
        if (x < bounds.x) { width -= (bounds.x - x); x = bounds.x; }
        if (y < bounds.y) { height -= (bounds.y - y); y = bounds.y; }
        if (x + width > bounds.x + bounds.width) { width = bounds.x + bounds.width - x; }
        if (y + height > bounds.y + bounds.height) { height = bounds.y + bounds.height - y; }
        this.cropBox = { x, y, width, height };
    }

    drawCropBox() {
        const { x, y, width, height } = this.cropBox;

        // Fill the crop box with a semi-transparent color
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'; // Semi-transparent white
        this.ctx.fillRect(x, y, width, height);

        // Draw the border
        this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.7)';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);

        // Draw the resize handles
        this.ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
        const handleSize = this.resizeHandleSize;
        const halfHandle = handleSize / 2;
        Object.values(this.getHandles()).forEach(pos => {
            this.ctx.fillRect(pos.x - halfHandle, pos.y - halfHandle, handleSize, handleSize);
        });
    }

    getHandles() {
        if (!this.cropBox) return {};
        const { x, y, width, height } = this.cropBox;
        const handles = { 'tl': { x: x, y: y }, 'tr': { x: x + width, y: y }, 'bl': { x: x, y: y + height }, 'br': { x: x + width, y: y + height } };
        if (!this.options.aspectRatio) {
            Object.assign(handles, { 't': { x: x + width / 2, y: y }, 'b': { x: x + width / 2, y: y + height }, 'l': { x: x, y: y + height / 2 }, 'r': { x: x + width, y: y + height / 2 } });
        }
        return handles;
    }

    getHandleForMousePos(pos) {
        const handles = this.getHandles();
        const threshold = this.resizeHandleSize;
        for (const name in handles) {
            if (Math.abs(pos.x - handles[name].x) <= threshold && Math.abs(pos.y - handles[name].y) <= threshold) return name;
        }
        return null;
    }

    isWithinCropBox(pos) {
        return this.cropBox && (pos.x >= this.cropBox.x && pos.x <= this.cropBox.x + this.cropBox.width && pos.y >= this.cropBox.y && pos.y <= this.cropBox.y + this.cropBox.height);
    }

    updateCursor(pos) {
        const handle = this.cropBox ? this.getHandleForMousePos(pos) : null;
        if (handle) {
            if (handle === 'tl' || handle === 'br') this.canvas.style.cursor = 'nwse-resize';
            else if (handle === 'tr' || handle === 'bl') this.canvas.style.cursor = 'nesw-resize';
            else if (handle === 't' || handle === 'b') this.canvas.style.cursor = 'ns-resize';
            else this.canvas.style.cursor = 'ew-resize';
        } else if (this.isWithinCropBox(pos)) {
            this.canvas.style.cursor = 'move';
        } else {
            this.canvas.style.cursor = 'crosshair';
        }
    }

    getCropData() {
        if (!this.cropBox || this.cropBox.width <= 0 || this.cropBox.height <= 0) return null;

        // The backend needs crop coordinates relative to the *rotated* image.
        // The visual crop box on the canvas is already what the user wants.
        // We just need to calculate its position relative to the rotated image's top-left corner on the canvas and scale it up.

        const rotatedImageBounds = this.getImageBoundingBox();

        // The cropBox x,y is relative to the canvas's top-left.
        // We need it to be relative to the rotated image's top-left on the canvas.
        const relativeX = this.cropBox.x - rotatedImageBounds.x;
        const relativeY = this.cropBox.y - rotatedImageBounds.y;

        // Scale up the relative coordinates and the crop box dimensions.
        const finalX = relativeX / this.scale;
        const finalY = relativeY / this.scale;
        const finalWidth = this.cropBox.width / this.scale;
        const finalHeight = this.cropBox.height / this.scale;

        // The `originalImage` dimensions in the output should also reflect the rotation for clarity.
        const isSwapped = (this.rotation / 90) % 2 !== 0;

        return {
            originalImage: {
                width: isSwapped ? this.image.height : this.image.width,
                height: isSwapped ? this.image.width : this.image.height
            },
            cropInfo: {
                x: Math.round(finalX),
                y: Math.round(finalY),
                width: Math.round(finalWidth),
                height: Math.round(finalHeight),
                rotate: this.rotation
            }
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const cropper = new ImageCropper('imageCanvas', {
        width: 400,
        hegiht: 600,
        aspectRatio: null
    });

    const imageLoader = document.getElementById('imageLoader');
    imageLoader.addEventListener('change', (e) => {
        const reader = new FileReader();
        reader.onload = (event) => { cropper.loadImage(event.target.result); }
        reader.readAsDataURL(e.target.files[0]);
    });

    const rotateBtn = document.getElementById('rotateBtn');
    rotateBtn.addEventListener('click', () => { cropper.rotate(); });

    const cropBtn = document.getElementById('cropBtn');
    const output = document.getElementById('output');
    cropBtn.addEventListener('click', () => {
        const data = cropper.getCropData();
        if (data) {
            output.textContent = 'Sending data to server...';
            fetch('index.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })
            .then(response => response.ok ? response.json() : Promise.reject(new Error(`HTTP error! status: ${response.status}`)))
            .then(result => { output.textContent = JSON.stringify(result, null, 2); })
            .catch(error => {
                console.error('Error:', error);
                output.textContent = `Error sending data to server: ${error.message}. See console for details.`;
            });
        } else {
            output.textContent = 'Please select a crop area.';
        }
    });
});