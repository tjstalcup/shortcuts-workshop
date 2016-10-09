var api = require('marvel-api');
var Character = require('./models/character');
var Series = require('./models/series');
var Comic = require('./models/comic');
var Read = require('./models/read');

// command + f - find
// command + g - next result
// command + i - find and edit
// command + alt + f - find and replace
// command + shift + f - find in project

// command + K, command + 1
// fold all
// command + K, command + J
// unfold all
module.exports = function(app, passport){

	// command + K, command + 2
	// fold second level of indentation
	var marvel = api.createClient({
	  publicKey: '629306f6ee3a76a9edb4bf7f908c11fe', 
	  privateKey: '298af9ed6d48e71b8224e7e53f68b335f2587274'
	});

	// Loads Home Page
	// command + alt + [
	// fold one block
	// command + alt + ]
	// unfold one block
	app.get('/', function(req,res){
		Character.find({show: 'Yes'}, function(err, data){
			if(err){
				return err;
			}
			res.render('character.ejs', {user: req.user, characters: data}); 
		});
	});
	// Loads Character Page 
	app.get('/character/:id', function(req, res, next){
		var character;
		var series = [];
		var readArr = [];
		if(typeof req.user !== "undefined"){
			
			Read.find({user: req.user._id}, function(err2, data2){
				if(err2){
					return err2;
				}
				if(typeof data2[0] !== "undefined"){
					for (var i = 0; i < data2.length; i++) {
						readArr.push(parseInt(data2[i].comicID));
					}
				}
			});
		}
		// Callback allows all the database calls to finish before rendering the page
		var cb = function(char, seriesItem){
			character = char;

			Series.find({seriesID: seriesItem}, function(err, data){
				if(err){
					return err;
				}
				if(typeof data[0] === "undefined"){
					
					marvel.series.find(seriesItem, function(err2, results){
						if(err2){
							return res.sendStatus(err2);
						}
						var comicList = [];
						for (var j = 0; j < results.data[0].comics.items.length; j++) {
					  		var comicid = results.data[0].comics.items[j].resourceURI.split('comics/');
					  		comicList.push(comicid[1]);
				  		}

				  		var data2 = [];
				  		data2[0] = {
				  			name: results.data[0].title,
							seriesID: results.data[0].id,
							thumbnail: results.data[0].thumbnail.path + '.' + results.data[0].thumbnail.extension,
							numOfComics: results.data[0].comics.available,
							comics: comicList
				  		};

						Series.create(data2[0],function(err3, series){
							if(err3){
								return res.status(500).json({
									message: 'Error'+ err
								});
							}
						});

						series.push(data2[0]);
						if(series.length == character.series.length){
							res.render('series.ejs', {user: req.user, character: character, series: series, read: readArr}); 
						}
					});	
				}
					else {
						series.push(data[0]);
						//checkComicCount(data[0]);
						if(series.length == character.series.length){
							res.render('series.ejs', {user: req.user, character: character, series: series, read: readArr}); 
							next();
					}
				}
			});
		};

		Character.find({charID: req.params.id}, function(err, data){
			if(err){
				return err;
			}
			
			for (var i = 0; i < data[0].series.length; i++) {
				cb(data[0], data[0].series[i]);
			}
		});
	});

	function checkComicCount(series){
		var offset = 0;
		var limit = 20;
		var numPages = Math.ceil(series.numOfComics/limit); //22.05 -> 23
		
		if(series.comics.length < series.numOfComics){
			for (var i = 1; i < numPages; i++) {
				// when we start we already have the first 20 comics of the series
				// so we are starting w/ page 2 (offset 20)
				// on the next loop 20 * 2 = 40
				// 22 * 20 = 440
				offset = limit * i;
				marvel.series.comics(series.seriesID,limit,offset)
				  .then(cb)
				  .fail(console.error)
				  .done();
				// marvel.series.comics(series.seriesID, limit, offset, cb());	
			}
		}

		function cb(res){

			console.log(res.data[0].series);

			for (var i = 0; i < res.data.length; i++) {
				series.comics.push(createComicFromAPI(res.data[i],series.seriesID));
			}

			if(series.comics.length == series.numOfComics){
				Series.update({seriesID: series.seriesID, comics: series.comics}, function(err,series){
					console.log('series updated');
				});
			}
		}
	}

	function createComicFromAPI(comic,seriesID){
		var chars = [];

		for(var i = 0; i < comic.characters.items.length; i++){
			var charID = comic.characters.items[i].resourceURI.split('characters/');
			chars.push(parseInt(charID[1]));
		}
		var detailUrl = "";
		for (var j = 0; j < comic.urls.length; j++) {
			if(comic.urls[j].type == "detail"){
				detailUrl = comic.urls[j].url;
			}
		}
  		var data3 = [];
  		data3[0] = {
  			name: comic.title,
  			comicID: parseInt(comic.id),
  			thumbnail: comic.thumbnail.path + '.' + comic.thumbnail.extension,
  			series: parseInt(seriesID),
  			characters: chars,
  			detail: detailUrl
  		};

		Comic.create(data3[0],function(err, series){
			if(err){
				return res.status(500).json({
					message: 'Error'+ err
				});
			}
		});

		return data3[0].comicID;
	}

	// Loads Series Page
	app.get('/series/:id/:charid', function(req, res){
		var series;
		var comics = [];
		var read = [];
		var character = req.params.charid;
		if(typeof req.user !== "undefined"){
			var userID = req.user._id;
		}
		
		var cb = function(s, comicID){
			series = s;
			if(typeof userID !== "undefined"){
				Read.find({user: userID, comicID: comicID}, function(err, data){
					if(err){
						return err;
					}
					if(typeof data[0] !== "undefined"){
						read.push(parseInt(data[0].comicID));
					}
				});
			}

			Comic.find({comicID: comicID}, function(err2, data2){

				if(typeof data2[0] === "undefined"){
					marvel.comics.find(comicID, function(err3, results){
						if (err3) {
						    return console.error(JSON.stringify(err3));
						}
						
						comics.push(createComicFromAPI(results.data[0],s.seriesID));
						if(comics.length == series.comics.length){
							res.render('comic.ejs', {user: req.user, comics: comics, series: series, read: read, character: character}); 
						}
					});
				}
				else{
					comics.push(data2[0]);
					if(comics.length == series.comics.length){
						res.render('comic.ejs', {user: req.user, comics: comics, series: series, read: read, character: character}); 
					}
				}
			});
		};

		Series.find({seriesID: req.params.id}, function(err, data){
			if(err){
				return err;
			}
			for (var i = 0; i < data[0].comics.length; i++) {
				cb(data[0],data[0].comics[i]);
			}
		});
	});

	// Loads Comic Page
	// command + alt + ]
	app.get('/comic/:id', function(req, res){
		var readArr = [];
		var characters = [];
		if(typeof req.user !== "undefined"){
				Read.find({user: req.user._id, comicID: req.params.id}, function(err, data){
					if(typeof data[0] !== "undefined"){
						readArr.push(parseInt(data[0].comicID));
					}
					// else{
					// 	return;
					// }
				});
			}

		Comic.find({comicID: req.params.id}, function(err, data){
			if(err){
				return err;
			}
			for(var i = 0; i < data[0].characters.length; i++){
				characterFind(data[0].characters[i], i, data[0]);
			}
		});

		var characterFind = function(id, i, comic){
			Character.find({charID: id}, function(err, data2){
				if(err){
					return err;
				}
				characters.push(data2[0]);

				if(i == comic.characters.length - 1){
					res.render('detail.ejs', {user: req.user, comic: comic, characters: characters, read: readArr}); 
				}
			});
		};	
	});

	// Login
	app.get('/login', function(req, res){
		res.render('login.ejs', {user: req.user, message: req.flash('loginMessage') });
	});

	
	app.post('/login', passport.authenticate('local-login', {
        successRedirect : '/', 
        failureRedirect : '/login', 
        failureFlash : true, 
        session: true
    }));

	// Sign Up
	app.get('/signup', function(req, res){
		res.render('signup.ejs', {user: req.user, message: req.flash('signupMessage')});
	});

	
	app.post('/signup', passport.authenticate('local-signup', {
        successRedirect : '/',
        failureRedirect : '/signup', 
        failureFlash : true, 
        session: true
    }));

	// profile
	app.get('/profile', isLoggedIn, function(req, res){
		res.render('profile.ejs', {user: req.user});
	});	

	// logout
	app.get('/logout', function(req, res){
		req.logout();
		res.redirect('/');
	});

	// Loads Contact Page 
	app.get('/contact', function(req, res){
		res.render('contact.ejs', {user: req.user});
	});

	app.get('/read/:id', function(req, res){
		
		Read.find({comicID: req.params.id, user: req.user._id}, function(err, data){
			// Check to see if anything was found
			if(typeof data[0] === 'undefined'){
				// If not, create a document 
				Read.create({
					comicID: req.params.id,
					user: req.user._id
					}, function(err, read){
					if(err){
						return res.status(500).json({
							message: 'Error:' + err
						});
					}
					return res.status(200).end();
				});
			}
			else{
				// If yes, remove the returned document
				Read.findOneAndRemove({comicID: req.params.id, user: req.user._id}, function(err, read){
					if(err){
						return res.status(500).json({
							message: 'Error:' + err
						});
					}
					return res.status(200).end();
				});
			}
		});
	});
};

function isLoggedIn(req, res, next){
	if(req.isAuthenticated())
		return next();

	res.redirect('/');
}
