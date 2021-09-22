const path = require("path");
const fs = require("fs");
const os = require("os");
const sanitize = require("sanitize-filename");
const Jimp = require('jimp');
const text2png = require('text2png');
const express = require("express");
const app = express();
const Busboy = require("busboy");

Array.prototype.mapAsync = async function (fn) {
    let arr = [];
    for (let i = 0; i < this.length; i++) {
        arr[i] = await fn(this[i], i, this);
    }
    return arr;
}

Array.prototype.shuffle = function () {
    for (let i = this.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [this[i], this[j]] = [this[j], this[i]];
    }
    return this;
};

function getRandomColor() {
    var letters = '0123456789ABCDEF';
    var color = '#';
    for (var i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

app.use(function (req, res, next) {
    req.header("Access-Control-Allow-Origin", "*");
    req.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept"
    );
    next();
});
app.use(express.static("./"));

app.get("/", function (req, res) {
    res.send(
        '31'
    );
    res.end();
});

app.get('/:streamerName/:thumbnailName.png', function (req, res) {
    let { streamerName, thumbnailName } = req.params;
    thumbnailName = decodeURIComponent(thumbnailName).split('\\n').join('\n');
    console.log(thumbnailName)
    let filePath = sanitize(`${thumbnailName}`) + ".png";
    let thumbnailPath = "./thumbnails/" + streamerName + "/" + filePath;
    console.log(thumbnailPath)

    if (fs.existsSync(thumbnailPath)) {
        res.sendFile(path.resolve(__dirname, thumbnailPath));
    } else {
        res.sendStatus(404);
    }
});

app.post("/:streamerName", function (req, res) {
    let { streamerName } = req.params;
    var busboy = new Busboy({ headers: req.headers });
    let thumbnailName, imgPath, filePath;
    busboy.on("field", (fieldname, val) => {
        console.log("field", fieldname, val);
    })
    busboy.on("file", function (fieldname, file, filename, encoding, mimetype) {
        thumbnailName = decodeURIComponent(filename).split('\\n').join('\n');
        console.log(thumbnailName)
        filePath = sanitize(`${thumbnailName}`) + ".png";
        if (!fs.existsSync("./upload/"))
            fs.mkdirSync("./upload/");
        if (!fs.existsSync("./upload/" + streamerName + "/"))
            fs.mkdirSync("./upload/" + streamerName + "/");
        imgPath = "./upload/" + streamerName + "/" + filePath;
        console.log("Uploading: " + imgPath);
        file.pipe(fs.createWriteStream(imgPath));
    });
    busboy.on("finish", async function () {
        console.log("Upload complete");
        //res.writeHead(200, { Connection: "close" });
        //res.end(`https://${process.env.PROJECT_DOMAIN}.glitch.me/${imgPath}`);
        await makeThumbnail(streamerName, thumbnailName, res, await Jimp.read(imgPath));
        fs.rmSync(imgPath);
    });
    return req.pipe(busboy);
});

let server = app.listen(3000, function () {
    let host = server.address().address;
    let port = server.address().port;

    console.log("Example app listening at http://%s:%s", host, port);
});

let colors = require('./colors.json');
let inverts = require('./inverts.json');

async function makeThumbnail(streamerName, title, res, streamerImg) {
    title = title.replace(/\\n/g, '\n');

    let streamerImagesPaths;
    if (!streamerImg) {
        streamerImagesPaths = fs.readdirSync(path.join('.', 'streamers', streamerName)).map(p => path.join('.', 'streamers', streamerName, p)).shuffle();
    }
    let imagesFileNames = fs.readdirSync('./images/');
    let color = colors[streamerName];
    Jimp.prototype.colorize = function (c = color) {
        return this.color([{ apply: 'xor', params: [c] }])
    };
    let invert = inverts[streamerName];
    Jimp.prototype._invert = function (inv) {
        return inv ? this.invert() : this;
    };
    /* 
        if (!color) {
            colors[streamerName] = getRandomColor();
            color = colors[streamerName];
            fs.writeFileSync('./colors.json', JSON.stringify(colors, null, 4));
        }
     */
    let filePath = sanitize(`${title}`) + ".png";
    let thumbnailPath = "./thumbnails/" + streamerName + "/" + filePath;
    if (!fs.existsSync("./thumbnails/"))
        fs.mkdirSync("./thumbnails/");
    if (!fs.existsSync("./thumbnails/" + streamerName + "/"))
        fs.mkdirSync("./thumbnails/" + streamerName + "/");

    await (async () => {
        let streamer = !streamerImg ? await Jimp.read(streamerImagesPaths[0]) : streamerImg;
        let images = Object.fromEntries(await imagesFileNames.filter(p => p.endsWith('.png')).mapAsync(async p => [p.split('.').slice(0, -1).join('.'), await Jimp.read('./images/' + p)]));

        streamer
            .resize(1280, 720);

        let textOptions = {
            font: '100px "Rowdies"',
            localFontPath: './fonts/Rowdies-Regular.ttf',
            localFontName: '"Rowdies"',
            color: 'white',
            lineSpacing: 20,
            //textAlign: 'center',
            padding: 10,
            strokeWidth: 5,
            strokeColor: 'black',
        }

        let titleImages = [];
        let demoTitle = await Jimp.read(text2png("DEMO", textOptions));

        for (let i = title.split('\n').length - 1; i >= 0; i--) {
            const line = title.split('\n')[i];
            let titleImg = await Jimp.read(text2png(line, textOptions));
            console.log(i, titleImg.getWidth(), titleImg.getHeight())
            //titleImg.scaleToFit(1200, 387)
            if (titleImg.getWidth() > streamer.getWidth() - 2 * (29 + 20 - 10))
                titleImg
                    .scaleToFit(streamer.getWidth() - 2 * (29 + 20 - 10), 9999999)
            console.log(i, titleImg.getWidth(), titleImg.getHeight())
            titleImages.push(titleImg);
        }

        streamer
            .blit(title.split('\n').length > 2 ? images.title_shadow_3 : images.title_shadow, 0, 0)
            //.blit(images.overlay_for_fullhd.colorize().blit(images.overlay_border_for_fullhd.blit(images.overlay_border_fullhd, 0, 0), 0, 0), 0, 0)
            .blit(images.overlay_for_fullhd.colorize().blit(images.overlay_border_for_fullhd._invert(invert).blit(images.overlay_border_fullhd._invert(invert), 0, 0), 0, 0), 0, 0)
            //.blit(images.bottle.blit(images.twitch.colorize(), 86 + 47, 33).write('./temp/logo.png').scale(0.3), 23, 18)
            .blit(images.bottle._invert(invert).blit(images.twitch.colorize(), 86 + 47, 33).write('./temp/logo.png').scale(0.3), 23, 18)

        let lastLocation = streamer.getHeight() - (29 + 20 - 8);
        for (let i = 0; i < titleImages.length; i++) {
            const titleImg = titleImages[i];
            lastLocation -= demoTitle.getHeight()
            let deltaLocation = (demoTitle.getHeight() - titleImg.getHeight()) / 2;
            streamer.blit(titleImg, 29 + 20 - 10, lastLocation + deltaLocation) //streamer.getHeight() - (109 - 29) - 20
        }

        streamer.write(thumbnailPath, (err, value) => {
            if (res) {
                res.writeHead(200, { Connection: "close" });
                res.end(`https://${process.env.PROJECT_DOMAIN}.glitch.me/${encodeURIComponent(streamerName)}/${encodeURIComponent(sanitize(title))}.png`);
                console.log(`https://${process.env.PROJECT_DOMAIN}.glitch.me/${encodeURIComponent(streamerName)}/${encodeURIComponent(sanitize(title))}.png`);
                return;

                if (res.sendFile && sendFile) {
                    res.sendFile(path.resolve(__dirname, thumbnailPath));
                } else {
                    res.send(JSON.stringify({ t: 3, s: streamerName, n: title, d: `https://${process.env.PROJECT_DOMAIN}.glitch.me/${thumbnailPath}` }))
                }
            }
        }); // save
    })();
}