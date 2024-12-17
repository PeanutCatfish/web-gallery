const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

camera.position.z = 12;
camera.position.y = 0;

// Increase ambient light intensity and add directional lights
const ambientLight = new THREE.AmbientLight(0xffffff, 2);
scene.add(ambientLight);

// Add directional lights from different angles
const frontLight = new THREE.DirectionalLight(0xffffff, 1);
frontLight.position.set(1, 0, 10);
scene.add(frontLight);

const backLight = new THREE.DirectionalLight(0xffffff, 1);
backLight.position.set(0, 0, -10);
scene.add(backLight);

const galleryGroup = new THREE.Group();
scene.add(galleryGroup);

const radius = 6;
const height = 30;
const segment = 30;

const cylinderGeometry = new THREE.CylinderGeometry(
    radius,
    radius,
    height,
    segment,
    1,
    true
);

const cylinderMaterial = new THREE.MeshPhongMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide
});
const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);
galleryGroup.add(cylinder);

const textureLoader = new THREE.TextureLoader();
let availableImages = new Set();
let maxImageNumber = 50; // Set a reasonable upper limit

// Pre-check which images are available
async function checkAvailableImages() {
    for (let i = 1; i <= maxImageNumber; i++) {
        try {
            await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => {
                    availableImages.add(i);
                    resolve();
                };
                img.onerror = reject;
                img.src = `./assets/img${i}.jpg`;
            });
        } catch (e) {
            // Image doesn't exist, stop checking if we've found no images for 5 consecutive numbers
            if (i > 5 && !availableImages.has(i - 1) && !availableImages.has(i - 2) && 
                !availableImages.has(i - 3) && !availableImages.has(i - 4)) {
                break;
            }
        }
    }
    console.log(`Found ${availableImages.size} available images`);
}

function getRandomImage() {
    const imageArray = Array.from(availableImages);
    if (imageArray.length === 0) return 1; // Fallback to img1 if no images found
    return imageArray[Math.floor(Math.random() * imageArray.length)];
}

function loadImageTexture(imageNumber) {
    return new Promise((resolve, reject) => {
        if (!availableImages.has(imageNumber)) {
            console.warn(`Image ${imageNumber} not available, trying another...`);
            imageNumber = getRandomImage(); // Try another random image
        }
        
        const texture = textureLoader.load(
            `./assets/img${imageNumber}.jpg`,
            (loadedTexture) => {
                loadedTexture.generateMipmaps = true;
                loadedTexture.minFilter = THREE.LinearMipmapLinearFilter;
                loadedTexture.magFilter = THREE.LinearFilter;
                loadedTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
                resolve(loadedTexture);
            },
            undefined,
            (error) => {
                console.error(`Error loading image ${imageNumber}:`, error);
                // Try loading a different image if this one fails
                const newImageNumber = getRandomImage();
                if (newImageNumber !== imageNumber) {
                    loadImageTexture(newImageNumber).then(resolve).catch(reject);
                } else {
                    reject(error);
                }
            }
        );
    });
}

function createCurvedPlane(width, height, radius, segment) {
    const geometry = new THREE.BufferGeometry();
    const vertices = [];
    const indices = [];
    const uvs = [];

    const segmentsX = segment * 4;
    const segmentsY = Math.floor(height * 12);
    const theta = width / radius;

    for (let y = 0; y <= segmentsY; y++) {
        const yPos = (y / segmentsY - 0.5) * height;
        for (let x = 0; x <= segmentsX; x++) {
            const xAngle = (x / segmentsX - 0.5) * theta;
            const xPos = Math.sin(xAngle) * radius;
            const zPos = Math.cos(xAngle) * radius;
            vertices.push(xPos, yPos, zPos);

            uvs.push((x / segmentsX) * 0.8 + 0.1, y / segmentsY);
        }
    }

    for (let y = 0; y < segmentsY; y++) {
        for (let x = 0; x < segmentsX; x++) {
            const a = x + (segmentsX + 1) * y;
            const b = x + (segmentsX + 1) * (y + 1);
            const c = x + 1 + (segmentsX + 1) * (y + 1);
            const d = x + 1 + (segmentsX + 1) * y;
            indices.push(a, b, d);
            indices.push(b, c, d);
        }
    }
    
    geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3)
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    return geometry;
}

const numVerticalSections = 12;
const blocksPerSection = 4;
const verticalSpacing = 3.25;
const blocks = [];

const totalBlockHeight = numVerticalSections * verticalSpacing;
const heightBuffer = (height - totalBlockHeight) / 2;
const startY = -height / 2 + heightBuffer + verticalSpacing;

const sectionAngle = (Math.PI * 2) / blocksPerSection;
const maxRandomAngle = sectionAngle * 0.3;

async function createBlocks(baseY, yOffset, sectionIndex, blockIndex) {
    const blockGeometry = createCurvedPlane(5, 3, radius, 10);
    const imageNumber = getRandomImage()
    const texture = await loadImageTexture(imageNumber);

    const blockMaterial = new THREE.MeshPhongMaterial({
        map: texture,
        side: THREE.DoubleSide,
        toneMapped: false,
        emissive: 0xffffff,
        emissiveMap: texture,
        emissiveIntensity: 0.2
    });

    const block = new THREE.Mesh(blockGeometry, blockMaterial);
    block.position.y = baseY + yOffset;

    const blockContainer = new THREE.Group();
    const baseAngle = sectionAngle * blockIndex;
    const randomAngleOffset = (Math.random() * 2 - 1) * maxRandomAngle;
    const finalAngle = baseAngle + randomAngleOffset;

    blockContainer.rotation.y = finalAngle;
    blockContainer.add(block);

    return blockContainer;
}

async function initializeBlocks () {
    await checkAvailableImages();
    for (let section = 0; section < numVerticalSections; section++) {
        const baseY = startY + section * verticalSpacing;

        for (let i = 0; i < blocksPerSection; i++) {
            const yOffset = Math.random() * 0.2 - 0.1;
            const blockContainer = await createBlocks(baseY, yOffset, section, i);
            blocks.push(blockContainer);
            galleryGroup.add(blockContainer);
        }
    }
}

const lenis = new Lenis({
    autoRaf: true,
})

let currentScroll = 0;
const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
let rotationSpeed = 0;
const baseRotationSpeed = 0.0025;
const maxRotationSpeed = 0.05;

lenis.on("scroll", (e) => {
    currentScroll = window.pageYOffset;
    rotationSpeed = e.velocity * 0.005;
});

function animate () {
    requestAnimationFrame(animate);

    const scrollFraction = currentScroll / totalScroll;
    const targetY = scrollFraction * height - height / 2;
    camera.position.y = -targetY;

    galleryGroup.rotation.y += baseRotationSpeed + rotationSpeed;
    rotationSpeed *= 2;

    renderer.render(scene, camera);
}

initializeBlocks();
animate();