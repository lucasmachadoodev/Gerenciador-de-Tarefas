const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const http = require('http');
const socketIo = require('socket.io');
const session = require('express-session');
require('dotenv').config();
const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;
const io = require('socket.io')(server);

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/banco-teste', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Conectado ao MongoDB com sucesso');
    } catch (error) {
        console.error('Erro ao conectar ao MongoDB:', error);
        process.exit(1);
    }
};

connectDB();

const tarefaSchema = new mongoose.Schema({
    numero: { type: Number, required: true, unique: true },
    titulo: String,
    descricao: String,
    responsavel: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Usuario',
    },
    criadoPor: String,
    movimentadoPor: String,
    movimentadoEm: Date,
    status: { type: String, enum: ['Pendente', 'Em Andamento', 'Concluída', 'Vencida', 'Parado'], default: 'Pendente' },
    prioridade: { type: String, enum: ['Alta', 'Média', 'Baixa'], default: 'Baixa' },
    prazoFinal: Date,
    criadoEm: { type: Date, default: Date.now },
    motivoParado: { type: String, required: false },
    usuarioMotivo: { type: String, required: false },
    dataHoraMotivo: { type: Date, required: false },
    motivos: [{
        motivo: String,
        usuario: String,
        dataHora: { type: Date, default: Date.now }
    }]
});

const Motivo = mongoose.model('Motivo', new mongoose.Schema({
    tarefaId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tarefa', required: true },
    motivo: { type: String, required: true },
    usuario: { type: String, required: true },
    dataHora: { type: Date, default: Date.now }
}));

const Tarefa = mongoose.model('Tarefa', tarefaSchema);

const usuarioSchema = new mongoose.Schema({
    nome: String,
    email: { type: String, unique: true },
    senha: String,
});

const Usuario = mongoose.model('Usuario', usuarioSchema);

const counterSchema = new mongoose.Schema({
    _id: String,
    seq: { type: Number, default: 20239 }
});

const Counter = mongoose.model('Counter', counterSchema);

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: 'segredo_tarefa',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));
async function getNextSequenceValue(sequenceName) {
    let counter = await Counter.findOne({ _id: sequenceName });

    if (!counter) {
        counter = new Counter({
            _id: sequenceName,
            seq: 20239
        });
        await counter.save();
        console.log('Criando novo contador para', sequenceName);
        return 20239;
    }

    counter.seq += 1;
    await counter.save();

    console.log('Número gerado para', sequenceName, ':', counter.seq);
    return counter.seq;
}

function verificarAutenticacao(req, res, next) {
    if (!req.session.usuarioId) {
        return res.status(401).json({ message: 'Usuário não autenticado' });
    }
    next();
}

app.get('/proximo-id-tarefa', async (req, res) => {
    try {
        const nextId = await getNextSequenceValue('taskId');
        res.json({ id: nextId });
    } catch (error) {
        console.error('Erro ao buscar próximo ID:', error);
        res.status(500).json({ error: 'Erro ao obter próximo ID da tarefa' });
    }
});

app.put('/grupos/:id', (req, res) => {
    const grupoId = req.params.id;
    const { nome, usuarios } = req.body;

    Grupo.findByIdAndUpdate(grupoId, { nome, usuarios }, { new: true })
        .then(updatedGrupo => {
            if (!updatedGrupo) {
                return res.status(404).json({ message: 'Grupo não encontrado para atualização' });
            }
            res.json(updatedGrupo);
        })
        .catch(error => {
            res.status(500).json({ message: 'Erro ao atualizar grupo', error });
        });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});

app.get('/usuarios', async (req, res) => {
    try {
        const usuarios = await Usuario.find();
        res.json(usuarios);
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        res.status(500).send('Erro ao carregar usuários');
    }
});

app.get('/usuarios/:id', async (req, res) => {
    const usuarioId = req.params.id;
    try {
        const usuario = await Usuario.findById(usuarioId);
        if (!usuario) {
            return res.status(404).send('Usuário não encontrado');
        }
        res.json(usuario);
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).send('Erro ao buscar usuário');
    }
});

app.post('/motivo', verificarAutenticacao, async (req, res) => {
    const { tarefaId, motivo } = req.body;

    if (!req.session.nome) {
        return res.status(401).send('Usuário não autenticado');
    }

    try {
        const tarefa = await Tarefa.findById(tarefaId);
        if (!tarefa) {
            return res.status(404).send('Tarefa não encontrada');
        }

        tarefa.motivoParado = motivo;
        tarefa.usuarioMotivo = req.session.nome;
        tarefa.dataHoraMotivo = new Date();

        await tarefa.save();

        const novoMotivo = new Motivo({
            tarefaId: tarefa._id,
            motivo: motivo,
            usuario: req.session.nome,
            dataHora: new Date()
        });

        await novoMotivo.save();

        res.status(201).json({ message: 'Motivo registrado com sucesso!' });
    } catch (error) {
        console.error('Erro ao registrar motivo:', error);
        res.status(400).send('Erro ao registrar motivo');
    }
});
app.post('/tarefas', verificarAutenticacao, async (req, res) => {
    const { titulo, descricao, prioridade, prazoFinal } = req.body;
    const responsavel = req.session.usuarioId;

    console.log('Dados recebidos no backend:', req.body);  // Verifique os dados

    if (!titulo || !descricao || !responsavel || !prioridade || !prazoFinal) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    try {
        const numeroTarefa = await getNextSequenceValue('taskId');

        const novaTarefa = new Tarefa({
            titulo,
            descricao,
            responsavel,
            criadoPor: req.session.nome,
            prioridade,
            prazoFinal,
            numero: numeroTarefa
        });

        await novaTarefa.save();

        res.status(201).json({ message: 'Tarefa criada com sucesso!' });
    } catch (error) {
        console.error('Erro ao criar tarefa:', error);
        res.status(400).json({ error: 'Erro ao criar tarefa' });
    }
});

app.get('/motivos/:tarefaId', async (req, res) => {
    const { tarefaId } = req.params;

    try {
        if (!mongoose.Types.ObjectId.isValid(tarefaId)) {
            return res.status(400).json({ message: 'ID de tarefa inválido' });
        }

        const motivos = await Motivo.find({ tarefaId }).sort({ dataHora: -1 });

        if (!motivos || motivos.length === 0) {
            return res.status(404).json({ message: 'Nenhum motivo encontrado para esta tarefa' });
        }

        res.json(motivos);
    } catch (error) {
        console.error('Erro ao buscar motivos:', error);
        res.status(500).send('Erro ao buscar motivos');
    }
});
app.get('/tarefas', verificarAutenticacao, async (req, res) => {
    try {
        const usuarioId = req.session.usuarioId;
        const isMinhasTarefas = req.query.minhasTarefas === 'true';

        let tarefas;

        if (isMinhasTarefas) {
            tarefas = await Tarefa.find({ responsavel: usuarioId })
                .populate('responsavel', 'nome')
                .exec();
        } else {
            tarefas = await Tarefa.find({})
                .populate('responsavel', 'nome')
                .exec();
        }

        const tarefasComStatus = tarefas.map(tarefa => {
            const tempoRestante = new Date(tarefa.prazoFinal) - new Date();
            const horasRestantes = Math.floor(tempoRestante / (1000 * 60 * 60));

            let linhaClass = '';
            if (horasRestantes <= 24) {
                linhaClass = 'linha-amarela';
            }

            if (tempoRestante <= 0) {
                linhaClass = 'linha-vermelha';
            }

            return {
                ...tarefa.toObject(),
                tempoRestante,
                linhaClass
            };
        });

        res.json(tarefasComStatus);
    } catch (error) {
        console.error('Erro ao listar tarefas:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.put('/tarefas/:id', (req, res) => {
    const tarefaId = req.params.id;
    const { status, motivoParado, movimentadoPor, movimentadoEm } = req.body;

    if (!status) {
        return res.status(400).json({ error: 'O status é obrigatório' });
    }

    if (status === 'Parado' && !motivoParado) {
        return res.status(400).json({ error: 'O motivo é obrigatório para mover a tarefa para "Parado".' });
    }

    const updateData = {
        status,
        movimentadoPor,
        movimentadoEm,
        motivoParado: status === 'Parado' ? motivoParado : null
    };

    Tarefa.findByIdAndUpdate(tarefaId, updateData, { new: true })
        .then(tarefaAtualizada => {
            res.json(tarefaAtualizada);
        })
        .catch(error => {
            res.status(500).json({ error: 'Erro ao atualizar tarefa' });
        });
});

app.post('/cadastro', async (req, res) => {
    const { nome, email, senha } = req.body;

    try {
        const usuarioExistente = await Usuario.findOne({ email });
        if (usuarioExistente) {
            return res.status(400).send('Este e-mail já está em uso. Por favor, escolha outro.');
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(senha, saltRounds);

        const novoUsuario = new Usuario({ nome, email, senha: hashedPassword });
        await novoUsuario.save();

        res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });
    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        res.status(400).send('Erro ao cadastrar usuário');
    }
});

app.post('/login', async (req, res) => {
    const { email, senha } = req.body;

    try {
        const usuario = await Usuario.findOne({ email });
        if (!usuario) {
            return res.status(401).send('Credenciais inválidas');
        }

        const match = await bcrypt.compare(senha, usuario.senha);

        if (match) {
            req.session.usuarioId = usuario._id;
            req.session.nome = usuario.nome;
            res.json({ nome: usuario.nome });
        } else {
            res.status(401).send('Credenciais inválidas');
        }
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).send('Erro no servidor');
    }
});

app.get('/verificar-login', (req, res) => {
    if (req.session.usuarioId) {
        res.json({ autenticado: true, userName: req.session.nome });
    } else {
        res.json({ autenticado: false });
    }
});

const grupoSchema = new mongoose.Schema({
    nome: { type: String, required: true },
    usuarios: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }],
    tarefaAssociada: { type: mongoose.Schema.Types.ObjectId, ref: 'Tarefa' }
});

const Grupo = mongoose.model('Grupo', grupoSchema);

app.post('/grupos/:id/adicionar-usuario', async (req, res) => {
    const grupoId = req.params.id;
    const { usuarioId } = req.body;

    try {
        const grupo = await Grupo.findById(grupoId).populate('tarefaAssociada');
        if (!grupo) {
            return res.status(404).json({ message: 'Grupo não encontrado' });
        }

        const usuario = await Usuario.findById(usuarioId);
        if (!usuario) {
            return res.status(404).json({ message: 'Usuário não encontrado' });
        }

        if (grupo.usuarios.includes(usuario._id)) {
            return res.status(400).json({ message: 'Usuário já está no grupo' });
        }

        grupo.usuarios.push(usuario._id);

        if (grupo.tarefaAssociada) {
            usuario.tarefas.push(grupo.tarefaAssociada._id);
            await usuario.save();
        }

        await grupo.save();

        res.status(200).json(grupo);
    } catch (error) {
        console.error('Erro ao adicionar usuário ao grupo:', error);
        res.status(500).json({ message: 'Erro ao adicionar usuário ao grupo', error });
    }
});
app.post('/grupos/:id/excluir-usuario', async (req, res) => {
    const grupoId = req.params.id;
    const { usuarioId } = req.body;

    try {
        const grupo = await Grupo.findById(grupoId);
        if (!grupo) {
            return res.status(404).json({ message: 'Grupo não encontrado' });
        }

        if (!grupo.usuarios.includes(usuarioId)) {
            return res.status(404).json({ message: 'Usuário não encontrado no grupo' });
        }

        grupo.usuarios.pull(usuarioId);
        await grupo.save();

        res.status(200).json(grupo);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao excluir usuário do grupo', error });
    }
});

app.post('/grupos', async (req, res) => {
    try {
        const { nome, usuarios } = req.body;

        if (!nome || !usuarios) {
            return res.status(400).json({ message: 'Campos obrigatórios faltando' });
        }

        const numeroTarefa = await getNextSequenceValue('taskId');
        console.log('Número da tarefa gerado:', numeroTarefa);

        const novaTarefa = new Tarefa({
            titulo: 'Título da Tarefa',
            descricao: 'Descrição da Tarefa',
            numero: numeroTarefa,
            responsavel: usuarios[0],
            criadoPor: 'Admin',
            prioridade: 'Média',
            prazoFinal: new Date()
        });

        await novaTarefa.save();
        console.log('Tarefa criada com sucesso:', novaTarefa);

        const novoGrupo = new Grupo({
            nome,
            usuarios,
            tarefaAssociada: novaTarefa._id
        });

        await novoGrupo.save();
        console.log('Grupo criado com sucesso:', novoGrupo);

        novaTarefa.grupo = novoGrupo._id;
        await novaTarefa.save();

        return res.status(201).json(novoGrupo);
    } catch (error) {
        console.error('Erro ao criar grupo:', error);
        return res.status(500).json({ message: 'Erro ao salvar o grupo' });
    }
});

app.get('/grupos', async (req, res) => {
    try {
        const grupos = await Grupo.find().populate('usuarios');
        res.json(grupos);
    } catch (error) {
        res.status(500).json({ message: 'Erro ao buscar grupos', error });
    }
});

app.get('/grupos/:id', (req, res) => {
    const grupoId = req.params.id;

    Grupo.findById(grupoId)
        .populate('usuarios')
        .then(grupo => {
            if (!grupo) {
                return res.status(404).json({ message: 'Grupo não encontrado' });
            }
            res.json(grupo);
        })
        .catch(error => {
            res.status(500).json({ message: 'Erro ao recuperar o grupo', error });
        });
});

const users = {};
app.get('/', (req, res) => {
    res.send('Servidor está funcionando!');
});

io.on('connection', (socket) => {
    
    console.log('Novo cliente conectado:', socket.id);

    socket.on('login', (usuarioId) => {
        users[usuarioId] = socket.id;
    });

    socket.on('disconnect', () => {
        for (let userId in users) {
            if (users[userId] === socket.id) {
                delete users[userId];
                break;
            }
        }
        console.log('Cliente desconectado');
    });
});

app.delete('/tarefas/:id', verificarAutenticacao, async (req, res) => {
    const { id } = req.params;
    try {
        const tarefa = await Tarefa.findByIdAndDelete(id);
        if (!tarefa) return res.status(404).send('Tarefa não encontrada');

        io.emit('notificacao', {
            mensagem: `${req.session.nome} excluiu a tarefa "${tarefa.titulo}"`,
            destinatarios: [req.session.nome],
            link: `/minhas-tarefas`
        });

        if (tarefa.criadoPor !== req.session.nome) {
            io.emit('notificacao', {
                mensagem: `${req.session.nome} excluiu a tarefa "${tarefa.titulo}" que você criou`,
                destinatarios: [tarefa.criadoPor],
                link: `/minhas-tarefas`
            });
        }

        res.sendStatus(204);
    } catch (error) {
        console.error('Erro ao excluir tarefa:', error);
        res.status(400).send('Erro ao excluir tarefa');
    }
});

app.post('/atualizar-motivo', async (req, res) => {
    const { motivo, tarefaId, usuario } = req.body;
    try {
        const tarefa = await Tarefa.findById(tarefaId);
        if (!tarefa) return res.status(404).send('Tarefa não encontrada');
        
        tarefa.motivos.push({ motivo, usuario, dataHora: new Date() });
        await tarefa.save();

        res.status(200).json(tarefa);
    } catch (error) {
        console.error('Erro ao salvar motivo:', error);
        res.status(500).send('Erro ao salvar motivo');
    }
});