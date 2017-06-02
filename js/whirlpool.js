// global variables
var WIDTH = 600;        // width (pixels) of svg element
var HEIGHT = 600;       // height (pixels) of svg element
var MARGIN = 5;         // margin (pixel) around figure
var STROKE_WIDTH = 0.8;
var MOUNTAIN_COLOR = "#ff7f00";
var VALLEY_COLOR = "#777777";
var PAPER_COLOR = "#444";   // color for paper in outline mode
var PAPER_OPACITY = 0.05;    // paper opacity in outline mode

var ANGLE = 0;          // rotation angle of figure
var CENTER = [0, 0];    // center (x,y) of figure
var ZOOM = 1;           // zoom factor

var DRAW = null;        // svg.js SVG element
var VALLEYS = null;     // SVG group containing the valley folds (borders)
var MOUNTAINS = null;   // SVG group containing the mountain folds (diagonals)
var OUTLINE = null;     // SVG group containing the outline


var SVG_FILE = null;

// euclidean distance
function distance(p1, p2) {
    return Math.sqrt((p1[0]-p2[0])*(p1[0]-p2[0]) + (p1[1]-p2[1])*(p1[1]-p2[1]));
}

// compute point somewhere between p1 and p2
function middle(p1, p2, c) {
    c = c===undefined ? 0.5 : c;
    var v1 = (p2[0] - p1[0]);
    var v2 = (p2[1] - p1[1]);
    return [p1[0] + c*v1, p1[1] + c*v2];
}

// rotation of angle alpha of point p around c
function rotation(p, alpha, c) {
    c = c===undefined ? [0,0] : c;
    var x = (p[0]-c[0])*Math.cos(alpha) - (p[1]-c[1])*Math.sin(alpha) + c[0];
    var y = (p[0]-c[0])*Math.sin(alpha) + (p[1]-c[1])*Math.cos(alpha) + c[1];
    return [x,y];
}

function symmetric(p, a, b) {
    // compute the coordinates of the symmetric of p across line (a,b)
    var B, P, S, c;
    // translate so that a is the origin
    B = [b[0]-a[0], b[1]-a[1]];
    P = [p[0]-a[0], p[1]-a[1]];

    // coefficient using dot product
    c = (P[0]*B[0] + P[1]*B[1]) / (B[0]*B[0] + B[1]*B[1]);

    // projected point, translated back
    P = [c*B[0] + a[0], c*B[1] + a[1]];

    return [2*P[0] - p[0], 2*P[1] - p[1]];
}

// compute third point of a triangle from 2 points pa and pb, and the
// corresponding angles
function ASA_triangle(pa, pb, alpha, beta) {
    var gamma = Math.PI - alpha - beta;
    var c = distance(pa, pb);
    var b = c * Math.sin(beta) / Math.sin(gamma);
    var pc = rotation(middle(pa, pb, b/c), alpha, pa);
    return pc;
}

// compute all point of the crease pattern for whirlpool with parameters n,
// rho, sigma and h. (Refer to Tomoko Fuse's book for their meaning...)
function whirlpool_CP(n, rho, sigma, h, size) {

    // other important angles
    var beta = rho/2 + Math.PI/n;
    var gamma = Math.PI - sigma - beta;

    var delta = Math.PI/2 - rho/2;    // used to compute rotation center

    // grid of points: 2-dimensional array of size (n+1) x (h+1)
    var grid = [];

    // v1 and v2 are the vertices for the base of the second triangle of
    // successive lines.
    // The first triangle start (arbitrarily) at (0,0) and (0, size).
    // From that, we can compute the base of the second triangle:
    var v1 = [size, 0];
    var v2 = rotation([2*size, 0], rho, v1);
    var c = [0,0];
    var line = [];

    var i, j;
    for (j=0; j<h+1; j++) {

        // compute center of symmetry for this line's triangles bases.
        c = ASA_triangle(v1, v2, delta, delta);

        // compute all the points on this line
        line = [];
        for (i=-1; i<n; i++) {
            line.push(rotation(v1, i*rho, c));
        }
        grid.push(line);

        // we get the vertices from the first two triangles, giving the base
        // of the next line's second triangle.
        v1 = ASA_triangle(line[0], line[1], sigma, gamma);
        v2 = ASA_triangle(line[1], line[2], sigma, gamma);
    }

    return grid;
}

// NOTE: I could also compute the outline by taking the first ABCD shape and
// transforming it directly by translation, rotation, homothety
function whirlpool_outline(n, rho, sigma, h, size) {
    var T = whirlpool_CP(n, rho, sigma, h, size);
    var O = [];

    var i, j;
    var line;

    var a, b, c, d, x, na, nb, nc, nd, delta;

    // initial points
    a = T[0][0];
    b = T[1][0];
    c = T[1][1];
    d = symmetric(T[0][1], a, c);

    for (j=0; j<=h; j++) {
        line = [a];
        for (i=0; i<n; i++) {
            line.push(d);
            x = d;
            d = rotation(a, (n-2)*Math.PI/n,d);
            a = x;
        }
        O.push(line);

        // compute the next points (except when at last row)
        if (j === h) {
            // don't do anything for last row
            break;
        } else if (j === h-1) {
            // for next to last, we cannot look for the next row in T (there
            // is none): we just take the c and d point from the current row
            a = b; d = c;
        } else {
            // otherwise, we take the next shape in T, and translate/rotate it
            // to align with the current shape...

            // new points
            na = T[j+1][0];
            nb = T[j+2][0];
            nc = T[j+2][1];
            nd = symmetric(T[j+1][1], na, nc);

            // translate new points so that new point A lies on top on old point B
            delta = [b[0]-na[0], b[1]-na[1]];
            na = [na[0]+delta[0], na[1]+delta[1]];
            nb = [nb[0]+delta[0], nb[1]+delta[1]];
            nc = [nc[0]+delta[0], nc[1]+delta[1]];
            nd = [nd[0]+delta[0], nd[1]+delta[1]];

            // rotate new points around new A (== old B) so that new point D lies
            // on top of old point C
            angle = Math.atan2(c[1]-b[1], c[0]-b[0]) - Math.atan2(nd[1]-na[1], nd[0]-na[0]);
            if (angle < 0) angle += 2 * Math.PI;
            na = rotation(na, angle, na);
            nb = rotation(nb, angle, na);
            nc = rotation(nc, angle, na);
            nd = rotation(nd, angle, na);

            a = na; b = nb; c = nc; d = nd;
        }
    }
    return O;
}

// compute bounding box of a grid of points and update the global variable
// CENTER and ZOOM
function center(T) {
    var x_min=T[0][0][0];
    var x_max=T[0][0][0];
    var y_min=T[0][0][1];
    var y_max=T[0][0][1];
    var i, j;
    for (i=0; i<T.length; i++) {
        for (j=0; j<T[i].length; j++) {
            x_min = Math.min(x_min, T[i][j][0]);
            x_max = Math.max(x_max, T[i][j][0]);
            y_min = Math.min(y_min, T[i][j][1]);
            y_max = Math.max(y_max, T[i][j][1]);
        }
    }
    CENTER = [(x_max+x_min)/2, (y_max+y_min)/2];
    ZOOM = Math.min(WIDTH/(x_max-x_min+2*MARGIN), HEIGHT/(y_max-y_min+2*MARGIN));
}

// transformation to get pixel coordinates from "real" coordinates, depending
// on CENTER and ZOOM
function transf(p) {
    var x = p[0], y = p[1];
    x = x - CENTER[0];
    y = y - CENTER[1];
    x = ZOOM * x;
    y = ZOOM * y;
    x = x + WIDTH/2;
    y = HEIGHT - (y + HEIGHT/2);
    var angle = Math.PI*ANGLE/180.0;
    p = rotation([x, y], angle, CENTER);
    return p;
}

// main function: draws the crease pattern by looking up the parameters
function draw_CP() {
    // clear existing (if any) crease pattern
    DRAW.clear();
    DRAW.height(HEIGHT);
    DRAW.width(WIDTH);

    // create the two groups for the two kinds of creases
    MOUNTAINS = DRAW.group();
    VALLEYS = DRAW.group();

    var n =  parseInt($('#n').val());
    var rho =  parseFloat($('#rho').val());
    var sigma =  parseFloat($('#sigma').val());
    var h =  parseInt($('#h').val());

    // converting degres to radians
    rho = rho*Math.PI/180;
    sigma = sigma*Math.PI/180;

    // compute grid of points
    var T = whirlpool_CP(n, rho, sigma, h, 100);
    // compute CENTER and ZOOM factor
    center(T);

    // draw all the diagonal folds
    var i, j;
    var a, b, c, d;
    for (i=0; i<n; i++) {
        for (j=0; j<h; j++) {
            a = T[j][i];
            c = T[j+1][i+1];
            MOUNTAINS.polyline([a, c].map(transf)).stroke({width: STROKE_WIDTH, color: MOUNTAIN_COLOR});
        }
    }

    // draw all the grid folds
    var line, w;
    for (j=0; j<=h; j++) {
        line = [T[j][0]];
        for (i=0; i<n; i++) {
            line.push(T[j][i+1]);
        }
        w = j===0 || j===h ? STROKE_WIDTH*2 : STROKE_WIDTH;
        VALLEYS.polyline(line.map(transf)).fill("none").stroke({width: w, color:VALLEY_COLOR});
    }
    for (i=0; i<=n; i++) {
        line = [T[0][i]];
        for (j=0; j<h; j++) {
            line.push(T[j+1][i]);
        }
        w = i===0 || i===n ? STROKE_WIDTH*2 : STROKE_WIDTH;
        VALLEYS.polyline(line.map(transf)).fill("none").stroke({width: w, color:VALLEY_COLOR});
    }

    // create link to download svg file
    var link = $("#download_svg");
    link.attr("href", create_svg_content(DRAW.svg()));
}

function draw_outline() {
    // clear existing (if any) crease pattern
    DRAW.clear();

    // create the two groups for the two kinds of creases
    OUTLINE = DRAW.group();

    var n =  parseInt($('#n').val());
    var rho =  parseFloat($('#rho').val());
    var sigma =  parseFloat($('#sigma').val());
    var h =  parseInt($('#h').val());

    // converting degres to radians
    rho = rho*Math.PI/180;
    sigma = sigma*Math.PI/180;


    // compute outline
    var O = whirlpool_outline(n, rho, sigma, h, 100);

    // compute CENTER and ZOOM factor
    center(O);

    var i, j;
    var a, b, c, d;

    // draw all the grid folds
    var line, w;
    for (j=0; j<=h; j++) {
        line = [O[j][0]];
        for (i=0; i<n; i++) {
            line.push(O[j][i+1]);
        }
        w = j===0 || j===h ? STROKE_WIDTH*2 : STROKE_WIDTH/2;
        OUTLINE.polyline(line.map(transf)).fill("none").stroke({width: w, color:VALLEY_COLOR});
    }
    for (i=0; i<=n; i++) {
        line = [O[0][i]];
        for (j=0; j<h; j++) {
            line.push(O[j+1][i]);
        }
        w = i===0 || i===n ? STROKE_WIDTH*2 : STROKE_WIDTH/2;
        OUTLINE.polyline(line.map(transf)).fill("none").stroke({width: w, color:VALLEY_COLOR});
    }
    for (i=0; i<n; i++) {
        for (j=0; j<h; j++) {
            a = O[j][i];
            c = O[j+1][i+1];
            OUTLINE.polygon([a, c].map(transf)).fill("none").stroke({width: STROKE_WIDTH/2, color: VALLEY_COLOR});
        }
    }

    // draw all the triangles
    for (i=0; i<n; i++) {
        for (j=0; j<h; j++) {
            a = O[j][i];
            b = O[j][i+1];
            c = O[j+1][i+1];
            d = O[j+1][i];
            OUTLINE.polygon([a, b, c].map(transf)).fill(PAPER_COLOR).opacity(PAPER_OPACITY).stroke({width: 0});
            OUTLINE.polygon([a, d, c].map(transf)).fill(PAPER_COLOR).opacity(PAPER_OPACITY).stroke({width: 0});
        }
    }

    // create link to download svg file
    var link = $("#download_svg");
    link.attr("href", create_svg_content(DRAW.svg()));
}

function update_config() {
    STROKE_WIDTH = parseFloat($("#stroke_width").val());
    MOUNTAIN_COLOR = $("#mountain_color").val();
    VALLEY_COLOR = $("#valley_color").val();
    MARGIN = parseInt($("#margin").val());
    WIDTH = parseInt($("#width").val());
    HEIGHT = parseInt($("#height").val());
    PAPER_COLOR =  $("#paper_color").val();
    PAPER_OPACITY =  parseFloat($("#paper_opacity").val());
}

function draw() {
    update_config();
    if ($("#outline").is(":checked")) {
            draw_outline();
    } else {
        draw_CP();
    }
}


// create a virtual file to download
function create_svg_content(content) {
    var data = new Blob([content], {type: 'text/svg'});
    if (SVG_FILE !== null) {
        window.URL.revokeObjectURL(SVG_FILE);
    }
    SVG_FILE = window.URL.createObjectURL(data);
    return SVG_FILE;
}

// update max possible values for rho and sigma parameters
function update_range() {
    // 0 < rho <= 180/n
    // 0 < sigma <= (180-360/n)/2 = 90 - 180/n
    var n = parseInt($("#n").val());
    var rho = $("#rho");
    var sigma = $("#sigma");
    rho.attr("max", 180/n);
    rho.val(Math.min(rho.val(), 180/n));
    sigma.attr("max", 90-180/n);
    sigma.val(Math.min(sigma.val(), 90-180/n));
}

$(document).ready(function() {
    $("#no_javascript").remove();
    DRAW = SVG("CP").size(WIDTH, HEIGHT);
    update_range();
    draw();

    $("#n").bind("input", update_range);
    $("#n").bind("input", draw);
    $("#rho").bind("input", draw);
    $("#sigma").bind("input", draw);
    $("#h").bind("input", draw);
    $("#outline").bind("change", draw);

    $("#update_button").click(draw);
});
