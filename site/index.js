var express = require('express');
var session = require('express-session');
var mongoose = require('mongoose');
var dotenv = require('dotenv');
var bodyParser = require('body-parser');
var path = require('path');
var ejs = require('ejs');

const app = express();
dotenv.config();

const PORT = process.env.PORT || 7000;
const MONGO_URL = process.env.MONGO_URL;

mongoose.connect(MONGO_URL).then(()=> {
    console.log("Database is connected!");
    app.listen(PORT, ()=> {
        console.log(`Server is running on port ${PORT}`);
    });
})
.catch((error)=>{console.log(error);})

const userSchema = new mongoose.Schema({
    nome: String,
    sobrenome: String,
    nascimento: String,
    senha: String,
    email: String,
    favoritos: Array
});

const imageSchema = new mongoose.Schema({
    show: String,
    imagem: String
})

const showSchema = new mongoose.Schema({
    autor: String,
    evento: String,
    data: {
        completa: String,
        simples: String,
        horario: String,
        dia: Number,
        mes: Number,
        ano: Number,
    },
    local: {
        link: String,
        embed: String,
        endereco: String,
        local: String,
        estado: String,
        cidade: String
    },
    imagem: String
})

const userModel = mongoose.model("usuarios", userSchema);
const showModel = mongoose.model("shows", showSchema);
const imageModel = mongoose.model("galeria", imageSchema, 'galeria');

app.use(session({secret:'jann9283bnauyg127612b'}));
app.use(bodyParser.urlencoded({extended:true}));

app.engine('html', ejs.renderFile);
app.set('view engine', 'html');
app.use(express.static('public'));
app.set('views', path.join(__dirname, '/views'));

app.post('/login', async (req, res) => { 


    const email = req.body.email;
    const senha = req.body.senha;
    
    const query = userModel.findOne({'email': email});
    query.select('nome senha favoritos');
    const user = await query.exec();

    if (email == '') {
        res.render("index", {feedback: "É obrigatório preencher todos os campos."})
        return;
    }

    if (user === null) {
        res.render("index", {feedback: `Nenhum usuário com o e-mail '${email}' encontrado.`});
        return;
    }

    if (senha != user.senha) {
        res.render("index", {feedback: `A senha para ${user.nome} está incorreta.`});
        return;
    }

    req.session.login = email;
    res.redirect('/');

})

app.post('/logout', (req, res) => {

    console.log('-------------------------------');
    console.log('Destruindo sessão agora')
    req.session.destroy();
    console.log(req.session?.login);
    console.log('-------------------------------');

    res.redirect('index');
    
})

app.post('/password', async (req, res) => {

    const email = req.body.email;
    const senha = req.body.senha;
    const senha2 = req.body.senha2;

    const query = userModel.findOne({'email': email});
    query.select('email senha');
    const user = await query.exec();

    if (
        senha == '' ||
        senha2 ==  '' ||
        email == ''
    ) {
        res.render('senha', { feedback : 'Todos os campos precisam ser preenchidos obrigatoriamente.'});
        return;
    }

    if (user === null) {
        res.render('senha', { feedback : 'Não foi possível encontrar um usuário com este e-mail.'});
        return;
    }

    if (senha != senha2) {
        res.render('senha', { feedback : 'As senhas não coincidem'});
        return;
    }

    await userModel.updateOne({'email': email}, {'senha': senha});

    res.redirect('/');

})

app.post('/signup', async (req, res) => {

    const nome = req.body.nome;
    const sobrenome = req.body.sobrenome;
    const nascimento = req.body.nascimento;
    const senha = req.body.senha;
    const senha2 = req.body.senha2;
    const email = req.body.email;

    const query = userModel.findOne({'email': email});
    query.select('email');
    const user = await query.exec();

    if (
        nome == '' ||
        sobrenome == '' ||
        nascimento == '' ||
        senha == '' ||
        senha2 ==  '' ||
        email == ''
    ) {
        res.render('cadastro', { feedback: 'Todos os campos precisam ser preenchidos obrigatoriamente.' })
        return;
    }

    if (user !== null) {
        res.render('cadastro', {feedback: 'Uma conta com este e-mail já está cadastrada!'});
        return;
    }

    if (senha != senha2) {
        res.render('cadastro', {feedback : 'As senhas não coincidem'});
        return;
    }

    const newUserData = {
        nome: nome,
        sobrenome: sobrenome,
        nascimento: nascimento,
        senha: senha,
        email: email,
    }

    const newUser = await userModel.insertMany(newUserData);

    console.log(newUser);

    req.session.login = email;

    res.redirect('/');

})

app.post('/favorite', async (req, res) => {
    
    if (req.body.favoritado == "nao") {
        await userModel.updateOne({ email: req.session.login}, { $push: { favoritos: req.body.showId } })
    } else {
        await userModel.updateOne({ email: req.session.login}, { $pull: { favoritos: req.body.showId } })
    }

    res.redirect(req.body.arquivo)
})

app.post('/details', async (req, res) => {
    const show = await showModel.findById(req.body.showId).select().exec();
    res.render('event_details', {show, show})
})

app.post('/deleteaccount', async (req, res) => {
    await userModel.findOneAndDelete({'email' : req.session.login});
    req.session.destroy();
    res.redirect('/');
})

app.get('/', (req, res) => {
    res.redirect('index');
})

app.get('/index', (req, res) => {
    res.redirect('index.html')
})

app.get('/index.html', async (req, res) => {

    console.log('-------------------------------');
    console.log('Sessão atual:');
    console.log(req.session?.login);
    console.log('-------------------------------');
 
    const query = userModel.findOne({'email': req.session.login});
    query.select('nome email favoritos');
    const user = await query.exec();

    if (req.session.login) {
        var favoritosHTML = await EmbedShows(user.favoritos, true, user.favoritos, "/"); 
        favoritosHTML = favoritosHTML.join("");

        res.render('logado', {user : user, favoritosHTML : favoritosHTML});

        return;
    }

    res.render('index', {feedback: ""});
})

app.get('/cadastro.html', (req, res) => {
    res.render('cadastro', { feedback : "" });
})

app.get('/calendario.html', async (req, res) => {
    res.render('calendario', { eventsHTML : (await EmbedEventos()).join("")});
})

app.get('/contato.html', (req, res) => {
    res.render('contato');
})

app.get('/galeria.html', async (req, res) => {
    res.render('galeria', { imagesHTML : (await EmbedImages()).join("")});
})

app.get('/carrinho.html', (req, res) => {
    res.render('carrinho');
})

app.get('/shows.html', async (req, res) => {
    const showsList = (await showModel.find().select('_id').exec()).map(show => show.id);

    var favsIds = new Array;
    var logado = false;

    if (req.session.login) {
        favsIds = (await userModel.findOne({'email': req.session.login}).select('favoritos').exec()).favoritos;
        logado = true;
    }

    var showsHTML = await EmbedShows(showsList, logado, favsIds, "/shows.html");
    showsHTML = showsHTML.join("");
    res.render('shows', {showsHTML: showsHTML});
})

app.get('/logado.html', async (req, res) => {
    res.redirect('/');
})

app.get('/senha.html', (req, res) => {
    res.render('senha', { feedback : "" });
})

async function EmbedShows(showsIds, logado, favsIds = new Array, arquivo) {

    var showHTMLArray = new Array;

    for (const showId of showsIds) {
        try {
            const showQuery = showModel.findById(showId);
            showQuery.select('autor imagem data local');
            var show = await showQuery.exec();
        } catch { continue; }

        var fav = "";

        if (logado) {
            fav = `
                <button type="submit" class="btn btn-ingressos w-100">
                    <img src="./images/${favsIds.includes(showId) ? "favoritado" : "estrela"}.png" class="invert iconbutton"> 
                </button>
            `;
        }

        var showEmbed = `
            <div class="card m-4 text-bg-dark">
                <img src="${show.imagem}">
                <div class="card-body">
                    <h5 class="card-title">${show.autor}</h5>
                    <p class="card-text">${show.data.completa}</p>
                    <p class="card-text">${show.local.local}</p>
                    <div class="row p-2">
                        <form action="/details" method="post" class="col-8 p-0">
                            <input type="hidden" name="showId" value="${show._id}">
                            <button type="submit" href="./event_details.html" class="btn w-100 btn-ingressos">Detalhes</button>
                        </form>
                        <div class="col-1"></div>
                        <form action="/favorite" method="post" class="col-2 p-0">
                            <input type="hidden" name="favoritado" value="${favsIds.includes(showId) ? "sim" : "nao"}">
                            <input type="hidden" name="showId" value="${show._id}">
                            <input type="hidden" name="arquivo" value="${arquivo}">
                            ${fav}
                        </form>
                    </div>
                </div>
            </div>
        `;
        showHTMLArray.push(showEmbed);
    }

    return showHTMLArray;
}

async function EmbedImages() {

    const images = await imageModel.find().select().exec();

    var imageHTMLArray = new Array;

    for (const image of images) {
        const autor = (await showModel.findById(image.show).select('autor').exec()).autor;

        var imageEmbed = `
            <form action="/details" method="post" class="imagem">
                <input type="hidden" name="showId" value="${image.show}">
                <button type="submit" style="background-image: url(${image.imagem});">
                    <label>${autor}</label>
                </button>
            </form>
        `;
        imageHTMLArray.push(imageEmbed);
    }

    return imageHTMLArray;
}

async function EmbedEventos(filtro = null) {
 
    const events = await showModel.find().sort({"data.dia" : 1}).sort({"data.horario" : 1}).select().exec();

    var eventsHTMLArray = new Array;

    var diaAnterior = 0;

    for (const event of events) {
        var newRow = ""

        if (diaAnterior !== event.data.dia){
            newRow = `
                <div class="col-12 mt-5 row-principal-agenda">
                    <h2>${event.data.dia} de Junho</h2>
                </div>

                <hr class="my-3">
            `
        }

        var eventEmbed = `
            ${newRow}
            <div class="row row-secundario-agenda">
                <div style="display: none;" class="${event.local.cidade}"></div>
                <div style="display: none;">${event.data.dia}</div>
                <div class="col-6">
                    <p>${event.data.horario}</p>
                </div>
                <div class="col-6">
                    <form action="/details" method="post">
                        <input type="hidden" name="showId" value="${event._id}">
                        <button type="submit" class="text-white fake-a" style="text-decoration: none;">
                            ${event.autor}
                        </button>
                    </form>
                </div>

                <div class="col-6">
                    <p class="mt-2">60 minutos</p>
                </div>

                <div class="col-6">
                    <p><a href="${event.local.link}"><img src="./images/marcador.svg"
                            style="width: 20px;" class="invert d-inline">
                        ${event.local.local}
                        </a>
                    </p>
                </div>
            </div>
            <hr class="my-3">           
        `;

        diaAnterior = event.data.dia;

        eventsHTMLArray.push(eventEmbed);
    }

    return eventsHTMLArray;   
}