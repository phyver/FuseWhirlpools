// global variables
var WIDTH = 600;        // width (pixels) of svg element
var HEIGHT = 600;       // height (pixels) of svg element
var ANGLE = 0;          // rotation angle of figure
var CENTER = [0, 0];    // center (x,y) of figure
var ZOOM = 1;           // zoom factor
var MARGIN = 5;         // margin (pixel) around figure

var DRAW = null;        // svg.js SVG element
var VALLEYS = null;     // SVG group containing the valley folds (borders)
var MOUNTAINS = null;   // SVG group containing the mountain folds (diagonals)

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
function whirlpool(n, rho, sigma, h, size) {

    // converting degres to radians
    rho = rho*Math.PI/180;
    sigma = sigma*Math.PI/180;

    // FIXME: check that somewhere
    // assert 0 < rho <= pi/n;
    // assert 0 < sigma <= (pi-2*pi/n)/2;

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

    // create the two groups for the two kinds of folds
    MOUNTAINS = DRAW.group();
    VALLEYS = DRAW.group();

    var n =  parseInt($('#n').val());
    var rho =  parseFloat($('#rho').val());
    var sigma =  parseFloat($('#sigma').val());
    var h =  parseInt($('#h').val());

    // compute grid of points
    var T = whirlpool(n, rho, sigma, h, 100);
    // compute CENTER and ZOOM factor
    center(T);

    // draw all the diagonal folds
    var i, j;
    var a, b, c, d;
    for (i=0; i<n; i++) {
        for (j=0; j<h; j++) {
            a = transf(T[j][i]);
            c = transf(T[j+1][i+1]);
            MOUNTAINS.line(a[0], a[1], c[0], c[1]).stroke({width: 1, color: "red"});
        }
    }

    // draw all the grid folds
    var line;
    for (j=0; j<=h; j++) {
        line = [transf(T[j][0])];
        for (i=0; i<n; i++) {
            line.push(transf(T[j][i+1]));
        }
        VALLEYS.polyline(line).fill("none").stroke({width: 1});
    }
    for (i=0; i<=n; i++) {
        line = [transf(T[0][i])];
        for (j=0; j<h; j++) {
            line.push(transf(T[j+1][i]));
        }
        VALLEYS.polyline(line).fill("none").stroke({width: 1});
    }

    // create link to download svg file
    var link = $("#download_svg");
    link.show();
    link.attr("href", create_svg_content(DRAW.svg()));
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

$(document).ready(function() {      // <<<1
    $("#no_javascript").remove();
    $("#update_button").click(draw_CP);
    DRAW = SVG("CP").size(WIDTH, HEIGHT);
    draw_CP();
});
