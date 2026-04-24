(async () => {
    if (history.scrollRestoration) {
        history.scrollRestoration = 'manual';
    }

    window.scrollTo(0, 0);

    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    // function resize() {
    //   canvas.width = window.innerWidth;
    //   canvas.height = window.innerHeight;
    //   // ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    // }

    // resize();
    // window.addEventListener('resize', resize);

    function checkSupport(codec) {
        return VideoDecoder.isConfigSupported({
            codec: codec === 'h264' ? 'avc1.42c033' : 'hvc1.1.6.L120.90',
        });
    }

    function showUnsupported() {
        document.getElementById('loading').innerHTML = 'Unsupported';
    }

    function drawImageCover(image, destW, destH) {
        const sw = image.displayWidth ?? image.codedWidth;
        const sh = image.displayHeight ?? image.codedHeight;
        const scale = Math.max(destW / sw, destH / sh);
        const tw = sw * scale;
        const th = sh * scale;
        const ox = (destW - tw) / 2;
        const oy = (destH - th) / 2;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(image, 0, 0, sw, sh, ox, oy, tw, th);
    }

    let portrait = window.innerWidth < window.innerHeight;
    let codec = 'h265';

    if (!('VideoDecoder' in window)) {
        return showUnsupported();
    }

    const [supportH265, supportH264] = await Promise.all([checkSupport('h265'), checkSupport('h264')]);

    if (!supportH265.supported && !supportH264.supported) {
        return showUnsupported();
    }

    if (supportH265.supported) {
        codec = 'h265';
    } else {
        codec = 'h264';
    }

    console.log(supportH265, supportH264);

    let hardwareAcceleration = 'prefer-hardware';

    if (/\bAndroid\b/i.test(navigator.userAgent)) {
        // The situation on android is very segmented
        // Certain hardware accelerated decoders are not efficient with random access
        // Need to find a better way to detect and degrade
        // file = 'assets/meridian_1k_h264.af';
        codec = 'h264';
        hardwareAcceleration = 'prefer-software';
    }

    // let file = `assets/${portrait ? 'p_' : ''}meridian_${codec}.af`;
    let file = `assets/panque.af`;

    const activeFrame = new ActiveFrame(file, {
        hardwareAcceleration,
        process: (frame) => {
            drawImageCover(frame, canvas.width, canvas.height);
            document.getElementById('frame').innerHTML = `Frame: ${activeFrame.frame}`;
        }
    });

    await activeFrame.loading;
    document.getElementById('loading').style.display = 'none';
    activeFrame.setFrame(0);

    window.addEventListener('scroll', function () {
        const scrollPosition = window.scrollY;
        const totalHeight = document.body.scrollHeight;
        const viewportHeight = window.innerHeight;
        const progress = scrollPosition / (totalHeight - viewportHeight);
        const frame = Math.round(progress * (activeFrame.manifest.totalFrames - 1));
        activeFrame.setFrame(frame);
    });
})();