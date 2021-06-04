const mongoose = require('mongoose');

const conectarDB = async()=>{
    try {
        await mongoose.connect(process.env.DB_MONGO,{
            useNewUrlParser: true,
            useUnifiedTopology: true,
            useFindAndModify: false,
            useCreateIndex: true
        });
        console.log('DB Conectada');
    } catch (error) {
        console.log('hubo un eror');
        console.log(error);
        process.exit(1); // detener la app
    }
}

module.exports= conectarDB;