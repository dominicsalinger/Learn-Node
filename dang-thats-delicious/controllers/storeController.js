const mongoose = require("mongoose");
const Store = mongoose.model("Store");
const multer = require('multer');
const multerOptions = {
    storage: multer.memoryStorage(),
    fileFilter(req, file, next) {
        const isPhoto = file.mimetype.startsWith('image/');
        if (isPhoto) {
            next(null, true);
        } else {
            next({
                _message: `That filetype isn't allowed!`
            }, false);
        }
    }
};
const jimp = require('jimp');
const uuid = require('uuid');

exports.homePage = (req, res) => {
    res.render("index");
};

exports.addStore = (req, res) => {
    res.render("editStore", {
        title: "Add Store"
    });
};

exports.upload = multer(multerOptions).single('photo');
exports.resize = async (req, res, next) => {
    // check if there is no new file to resize
    if (!req.file) {
        next(); // skip to the next middleware
        return;
    }
    const extension = req.file.mimetype.split('/')[1];
    req.body.photo = `${uuid.v4()}.${extension}`;

    // Resize the image
    const photo = await jimp.read(req.file.buffer);
    await photo.resize(800, jimp.AUTO);
    await photo.write(`./public/uploads/${req.body.photo}`);

    next();
};


// POST request to create stores
exports.createStore = async (req, res) => {
    const store = await (new Store(req.body)).save();
    req.flash('success', `Successfully Created ${store.name}. Care to leave a review?`);
    res.redirect(`/store/${store.slug}`);
};

exports.getStores = async (req, res) => {
    // Query the dn for list of all stores
    const stores = await Store.find();

    res.render('stores', {
        title: 'Stores',
        stores
    });
};

exports.editStore = async (req, res) => {
    // Find the store given the id
    const store = await Store.findOne({
        _id: req.params.id
    });

    // Confirm they are the owner of the store
    // TODO
    // Render out the edit form so the user can update their store
    res.render('editStore', {
        title: `Edit ${store.name}`,
        store
    });
};

exports.updateStore = async (req, res) => {
    // set the location data to be a point
    req.body.location.type = 'Point';
    const store = await Store.findOneAndUpdate({
        _id: req.params.id
    }, req.body, {
        new: true, // return the new store instead of the old one
        runValidators: true,
    }).exec();

    req.flash('success', `Successfully updated <strong>${store.name}</strong>. <a href="/stores/${store.slug}">View Store</a>`);
    res.redirect(`/stores/${store._id}/edit`);
};

exports.getStoreBySlug = async (req, res, next) => {
    const store = await Store.findOne({
        slug: req.params.slug
    });

    // Validate if there was a store
    if (!store) return next();

    res.render('store', {
        store,
        title: store.name
    });
};

exports.getStoresByTag = async (req, res, next) => {
    const tag = req.params.tag;
    const tagQuery = tag || { $exists: true };
    const tagsPromise = Store.getTagsList();
    const storesPromise = Store.find({ tags: tagQuery });
    const [tags, stores] = await Promise.all([tagsPromise, storesPromise]);
    res.render('tags', { tags, stores, title: 'Tags', tag });
};