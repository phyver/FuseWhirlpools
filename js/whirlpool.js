// global variables
var WIDTH = 600;        // width (pixels) of svg element
var HEIGHT = 600;       // height (pixels) of svg element
var ANGLE = 0;          // rotation angle of figure
var CENTER = [0, 0];    // center (x,y) of figure
var ZOOM = 1;           // zoom factor
var MARGIN = 5;         // margin (pixel) around figure
var STROKE_WIDTH = 0.8;
var MOUNTAIN_COLOR = "#ff7f00";
var VALLEY_COLOR = "#777777";

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

    // converting degres to radians
    rho = rho*Math.PI/180;
    sigma = sigma*Math.PI/180;

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

function whirlpool_outline(T) {
    O = [];

    var i, j;
    var A, B, C, D, a, b, c, d, nc, nd;

    for (j=0; j<h; j++) {
        if (j === 0) {
            A = T[j][0];
            B = T[j+1][0];
            C = T[j+1][1];
            D = symmetric(T[j][1], T[j][0], T[j+1][1]);
            origin = B;
        } else {
            angle = Math.atan2(C[1]-B[1], C[0]-B[0]);
            A = T[j][0];
            B = T[j+1][0];
            C = T[j+1][1];
            D = symmetric(T[j][1], T[j][0], T[j+1][1]);

            Delta = [ origin[0]-A[0], origin[1]-A[1] ];

            A = [A[0]+Delta[0], A[1]+Delta[1]];
            B = [B[0]+Delta[0], B[1]+Delta[1]];
            C = [C[0]+Delta[0], C[1]+Delta[1]];
            D = [D[0]+Delta[0], D[1]+Delta[1]];

            angle = angle - Math.atan2(D[1]-A[1], D[0]-A[0]);
            if (angle < 0) { angle = angle + 2*Math.PI; }
            B = rotation(B, angle, A);
            C = rotation(C, angle, A);
            D = rotation(D, angle, A);
            origin = B;
        }
        a = A;
        b = B;
        c = C;
        d = D;

        for (i=0; i<n; i++) {

            MOUNTAINS.polyline([a, b, c].map(transf)).fill("#bbb").opacity(0.2).stroke({width: 0, color: "black"});
            MOUNTAINS.polyline([a, d, c].map(transf)).fill("#bbb").opacity(0.2).stroke({width: 0, color: "black"});

            na = [A[0]+d[0]-A[0], A[1]+d[1]-A[1]];
            nb = [B[0]+d[0]-A[0], B[1]+d[1]-A[1]];
            nc = [C[0]+d[0]-A[0], C[1]+d[1]-A[1]];
            nd = [D[0]+d[0]-A[0], D[1]+d[1]-A[1]];

            alpha = Math.atan2(c[1]-d[1], c[0]-d[0]) - Math.atan2(nb[1]-na[1], nb[0]-na[0]);
            if (alpha < 0) {
                alpha = alpha + 2*Math.PI;
            }

            a = d;
            b = c;
            c = rotation(nc, alpha, d);
            d = rotation(nd, alpha, d);
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

    // create the two groups for the two kinds of creases
    MOUNTAINS = DRAW.group();
    VALLEYS = DRAW.group();

    var n =  parseInt($('#n').val());
    var rho =  parseFloat($('#rho').val());
    var sigma =  parseFloat($('#sigma').val());
    var h =  parseInt($('#h').val());

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
    var line;
    for (j=0; j<=h; j++) {
        line = [T[j][0]];
        for (i=0; i<n; i++) {
            line.push(T[j][i+1]);
        }
        VALLEYS.polyline(line.map(transf)).fill("none").stroke({width: STROKE_WIDTH, color:VALLEY_COLOR});
    }
    for (i=0; i<=n; i++) {
        line = [T[0][i]];
        for (j=0; j<h; j++) {
            line.push(T[j+1][i]);
        }
        VALLEYS.polyline(line.map(transf)).fill("none").stroke({width: STROKE_WIDTH, color:VALLEY_COLOR});
    }

    // create link to download svg file
    var link = $("#download_svg");
    link.attr("href", create_svg_content(DRAW.svg()));
}

function draw_outline() {
    // clear existing (if any) outline
    DRAW.clear();

    // create the two groups for the two kinds of creases
    MOUNTAINS = DRAW.group();

    var n =  parseInt($('#n').val());
    var rho =  parseFloat($('#rho').val());
    var sigma =  parseFloat($('#sigma').val());
    var h =  parseInt($('#h').val());

    // compute grid of points
    var T = whirlpool_CP(n, rho, sigma, h, 100);

    var i, j;
    var A, B, C, D, a, b, c, d, nc, nd;

    for (j=0; j<h; j++) {
        if (j === 0) {
            A = T[j][0];
            B = T[j+1][0];
            C = T[j+1][1];
            D = symmetric(T[j][1], T[j][0], T[j+1][1]);
            origin = B;
        } else {
            angle = Math.atan2(C[1]-B[1], C[0]-B[0]);
            A = T[j][0];
            B = T[j+1][0];
            C = T[j+1][1];
            D = symmetric(T[j][1], T[j][0], T[j+1][1]);

            Delta = [ origin[0]-A[0], origin[1]-A[1] ];

            A = [A[0]+Delta[0], A[1]+Delta[1]];
            B = [B[0]+Delta[0], B[1]+Delta[1]];
            C = [C[0]+Delta[0], C[1]+Delta[1]];
            D = [D[0]+Delta[0], D[1]+Delta[1]];

            angle = angle - Math.atan2(D[1]-A[1], D[0]-A[0]);
            if (angle < 0) { angle = angle + 2*Math.PI; }
            B = rotation(B, angle, A);
            C = rotation(C, angle, A);
            D = rotation(D, angle, A);
            origin = B;
        }
        a = A;
        b = B;
        c = C;
        d = D;

        for (i=0; i<n; i++) {

            MOUNTAINS.polyline([a, b, c].map(transf)).fill("#bbb").opacity(0.2).stroke({width: 0, color: "black"});
            MOUNTAINS.polyline([a, d, c].map(transf)).fill("#bbb").opacity(0.2).stroke({width: 0, color: "black"});

            na = [A[0]+d[0]-A[0], A[1]+d[1]-A[1]];
            nb = [B[0]+d[0]-A[0], B[1]+d[1]-A[1]];
            nc = [C[0]+d[0]-A[0], C[1]+d[1]-A[1]];
            nd = [D[0]+d[0]-A[0], D[1]+d[1]-A[1]];

            alpha = Math.atan2(c[1]-d[1], c[0]-d[0]) - Math.atan2(nb[1]-na[1], nb[0]-na[0]);
            if (alpha < 0) {
                alpha = alpha + 2*Math.PI;
            }

            a = d;
            b = c;
            c = rotation(nc, alpha, d);
            d = rotation(nd, alpha, d);
        }
    }
}


function draw() {
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
