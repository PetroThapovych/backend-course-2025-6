import { Command } from "commander";
import fs from "fs/promises";
import http from "http";

const program = new Command();

program
    .requiredOption("-c, --cache <path>", "шлях до директорії")
    .requiredOption("-h, --host <host>", "адреса сервера")
    .requiredOption("-p, --port <port>", "порт сервера");

program.parse(process.argv);
const options = program.opts();

async function ensureCacheDir(path){
    try{
        await fs.access(path);
        console.log("Директорія кешу:", path);
    } catch {
        console.log("Директорія не існує, створення:", path)
        await fs.mkdir(path, {recursive: true});
        console.log("Директорію створено:", path);
    }
}

await ensureCacheDir(options.cache);

const server = http.createServer(async (req, res) => {

});

server.listen(options.port, options.host, () => {
    console.log(`Сервер запущено на http://${options.host}:${options.port}`);
});
