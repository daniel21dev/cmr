const Usuario  = require('../models/Usuario');
const Producto = require('../models/Producto');
const Cliente  = require('../models/Cliente');
const Pedido   = require('../models/Pedido');

const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');

const crearToken = (usuario, secreta, expiresIn) =>{
    //console.log(usuario);
    const { id, email, nombre, apellido } = usuario;

    return jwt.sign({ id, nombre, apellido }, secreta, {expiresIn});
}

// Resolvers
const resolvers = {
    Query: {
        obtenerUsuario: async(_,{}, ctx) => {
            try {
                return ctx.usuario;
            } catch (error) {
                console.log(error);
            }  
        },
        obtenerProductos: async() =>{
            try {
                const productos = await Producto.find({});
                return productos;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerProducto: async(_, {id}) =>{
            // revisar si el producto existe
            const producto = await Producto.findById(id);

            if(!producto){
                throw new Error('Producto no existe');
            }

            return producto;
        },
        obtenerClientes: async ()=>{
            try {
                const clientes = await Cliente.find({});
                return clientes;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerClientesVendedor: async (_,{}, ctx)=>{
            try {
                const clientes = await Cliente.find({ vendedor: ctx.usuario.id.toString() });
                return clientes;
            } catch (error) {
                console.log(error);
            }
        },
        obtenerCliente: async (_, { id }, ctx)=>{
            // revisar si el cliente existe
            const cliente = await Cliente.findById(id);

            if(!cliente){
                throw new Error('el cliente no existe');
            }

            // Quien lo creo puede verlo
            if( cliente.vendedor.toString() !== ctx.usuario.id ){
                throw new Error('No tienes las credenciales');
            }

            return cliente;
        },
        obtenerPedidos: async ()=>{
            try {
                const pedidos = await Pedido.find({});
                return pedidos;
            } catch (error) {
                console.log( error );
            }
        },
        obtenerPedidosVendedor: async (_, {}, ctx)=>{
            try {
                const pedidos = await Pedido.find({ vendedor: ctx.usuario.id }).populate('cliente')
                return pedidos;
            } catch (error) {
                console.log( error );
            }
        },
        obtenerPedido: async(_, {id}, ctx) =>{
            // si el pedido existe o no
            const pedido = await Pedido.findById(id);
            if(!pedido){
                throw new Error(`pedido no encontrado`);
            }

            // solo quien lo creo puede verlo
            if( pedido.vendedor.toString() !== ctx.usuario.id ){
                throw new Error('No tiene las credenciales');
            }

            // retornar el resultado
            return pedido;
        },
        obtenerPedidosEstado: async (_,{ estado }, ctx) =>{
            const pedidos = await Pedido.find({ vendedor: ctx.usuario.id, estado});

            return pedidos;
        },
        mejoresClientes: async() =>{
            const clientes = await Pedido.aggregate([
                { $match : { estado: 'COMPLETADO'} },
                { $group :{
                    _id: '$cliente',
                    total: { $sum: '$total'}
                }},
                {
                    $lookup: {
                        from: 'clientes',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'cliente'
                    }
                },
                {
                    $sort: { total : -1}
                }
            ]);

            return clientes;
        },
        mejoresVendedores: async() =>{
            const vendedores = await Pedido.aggregate([
                { $match: { estado: 'COMPLETADO'} },
                { $group:{
                    _id: '$vendedor',
                    total: {$sum: '$total'}
                }},
                {
                    $lookup:{
                        from: 'usuarios',
                        localField: '_id',
                        foreignField: '_id',
                        as: 'vendedor'
                    }
                },
                {
                    $limit: 3
                },
                {
                    $sort: { total: -1 }
                }
            ])

            return vendedores;
        },
        buscarProducto: async(_, { texto }) =>{
            const productos = await Producto.find({ $text: { $search: texto } }).limit(10);

            return productos;
        }
    },
    Mutation: {
        nuevoUsuario: async(_,{ input }) => {
            
            const {email,password} = input;

            // revisar si el usuario ya esta registrado
            const existeUsuario = await Usuario.findOne({email});
            if(existeUsuario){
                throw new Error('El usuario ya esta registrado');
            }
            // Hashear su password
            const salt = await bcryptjs.genSalt(10);
            input.password = await bcryptjs.hash(password,salt);

            // Guardarlo en la base de datos
            try {
                const usuario = new Usuario(input);
                usuario.save();
                return usuario;
            } catch (error) {
                console.log(error);
            }
        },
        autenticarUsuario: async(_, {input}) =>{
            const {email,password} = input;
            // Si el usuario existe
            const existeUsuario = await Usuario.findOne({email});
            if(!existeUsuario){
                throw new Error('El usuario no existe');
            }
    
            // revisar si el password es correcto
            const passwordCorrecto = await bcryptjs.compare( password, existeUsuario.password );
            if( !passwordCorrecto ){
                throw new Error('El password es incorrecto');
            }
    
            //Crear el token 
            return{
                token: crearToken(existeUsuario, process.env.SECRETA, '24h' )
            }
        },
        nuevoProducto: async(_, {input}) =>{
            try {
                const producto = new Producto(input);

                // almacenar en base de datos
                const resultado = await producto.save();

                return resultado;
            } catch (error) {
                console.log(error);
            }
        },
        actualizarProducto: async(_,{ id, input})=>{
            // revisar si el producto existe
            let producto = await Producto.findById(id);

            if(!producto){
                throw new Error('Producto no existe');
            }

            // gaurdar en base de datos
            producto = await Producto.findOneAndUpdate({_id: id},input,{ new:true });
            return producto;
        },
        eliminarProducto: async(_,{id})=>{
            // revisar si el producto existe
            let producto = await Producto.findById(id);

            if(!producto){
                throw new Error('Producto no existe');
            }

            //Eliminar
            await Producto.findOneAndDelete({_id:id});
            return 'producto eliminado';
        },
        nuevoCliente: async (_,{ input }, ctx)=> {
            const {email} = input;
            // verificar si el cliente ya esta asiganado
            const cliente = await Cliente.findOne({ email });
            if( cliente ){
                throw new Error('Ese cliente ya esta registrado');
            }

            const nuevoCliente = new Cliente(input);
            //asignar el vendedor
            nuevoCliente.vendedor = ctx.usuario.id;
            // guardarlo en base de datos
            try {
                const resultado = await nuevoCliente.save();
                return resultado;
            } catch (error) {
                console.log(error);
            }
        },
        actualizarCliente: async (_,{ id, input }, ctx) =>{
            // verificar si existe 
            let cliente = await Cliente.findById(id);

            if(!cliente){
                throw new Error('Ese cliente no existe');
            }
            // verficar si el vendedor es quien edita
            if( cliente.vendedor.toString() !== ctx.usuario.id ){
                throw new Error('No tienes las credenciales');
            }
            // guardar cliente
            cliente = await Cliente.findOneAndUpdate({_id: id}, input,{new: true});
            return cliente;
        },
        eliminarCliente: async (_,{ id }, ctx) =>{
            // verificar si existe 
            let cliente = await Cliente.findById(id);

            if(!cliente){
                throw new Error('Ese cliente no existe');
            }
            // verficar si el vendedor es quien edita
            if( cliente.vendedor.toString() !== ctx.usuario.id ){
                throw new Error('No tienes las credenciales');
            }
            // eliminar cliente
            await Cliente.findOneAndDelete({_id:id});
            return "cliente eliminado";
        },
        nuevoPedido: async(_,{ input }, ctx)=>{

            const { cliente } = input;
            // verificar si el cliente existe
            let clienteExiste = await Cliente.findById(cliente);

            if(!clienteExiste){
                throw new Error('Ese cliente no existe');
            }
            // verificar si el cliente es el vendedor
            if( clienteExiste.vendedor.toString() !== ctx.usuario.id ){
                throw new Error('No tienes las credenciales');
            }
            // revisar que el stock este disponible
            for await ( const articulo of input.pedido ){
                const { id } = articulo;
                const producto = await Producto.findById(id);

                if( articulo.cantidad > producto.existencia ){
                    throw new Error(`El articulo: ${ producto.nombre } excede la cantidad disponible`);
                }else{
                    // restar la cantidad a lo disponible
                    producto.existencia = producto.existencia - articulo.cantidad;

                    await producto.save();
                }
            }

            // crear un nuevo pedido
            const nuevoPedido = new Pedido( input );

            // asignarle un vendedor
            nuevoPedido.vendedor  = ctx.usuario.id;

            // guardarlo en la base de datos
            const resultado = await nuevoPedido.save();
            return resultado;
        },
        actualizarPedido: async(_, {id, input}, ctx) => {
            const { cliente } = input;
            // verificar si el pedido existe
            const existePedido = await Pedido.findById( id );
            if( !existePedido ){
                throw new Error('El pedido no existe');
            }
            // si el cliente existe
            const existeCliente = await Cliente.findById( cliente );
            if( !existeCliente ){
                throw new Error('El pedido no existe');
            }
            // si el cliente y pedido pertenece al vendedor
            if( existeCliente.vendedor.toString() !== ctx.usuario.id ){
                throw new Error('No tienes las credenciales');
            }

            // revisar el stock
            if( input.pedido ){
                for await ( const articulo of input.pedido ){
                    const { id } = articulo;
                    const producto = await Producto.findById(id);
    
                    if( articulo.cantidad > producto.existencia ){
                        throw new Error(`El articulo: ${ producto.nombre } excede la cantidad disponible`);
                    }else{
                        // restar la cantidad a lo disponible
                        producto.existencia = producto.existencia - articulo.cantidad;
    
                        await producto.save();
                    }
                }
            }
            // guardar el pedido
            const resultado = await Pedido.findOneAndUpdate({_id: id}, input, { new: true });
            return resultado;

        },
        eliminarPedido: async(_,{ id }, ctx) =>{

            // ver si el pedido existe
            const pedido = await Pedido.findById( id );
            if( !pedido ){
                throw new Error('El pedido no existe');
            }
            
            if( pedido.vendedor.toString() !== ctx.usuario.id ){
                throw new Error('No tienes las credenciales');
            }

            // eliminar de la base de datos 
            await Pedido.findOneAndDelete({_id: id});
            return 'Pedido eliminado';
        }

    }
}

module.exports = resolvers;