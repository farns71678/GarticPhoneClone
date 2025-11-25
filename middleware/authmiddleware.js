const jwt = require('jsonwebtoken');

const checkUser = (req, res, next) => {
    const token = req.cookies.jwt;

    if (token) {
        jwt.verify(token, process.env.JWT_SECRET, (err, decodedToken) => {
            if (err) {
                res.locals.player = null;
                res.locals.room = null;
                next();
            }
            else {
                res.locals.player = decodedToken.id;
                res.locals.room = decodedToken.gameId;
                next();
            }
        })
    }
    else {
        res.locals.player = null;
        res.locals.room = null;
        next();
    }
}

module.exports = { checkUser };