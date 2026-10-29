import {createInterface} from 'node:readline/promises';
import {Writable} from 'node:stream';
import bcrypt from 'bcryptjs';
const output=new Writable({write(_chunk,_encoding,done){done();}}),rl=createInterface({input:process.stdin,output,terminal:process.stdin.isTTY});
try{
 process.stdout.write('API 설정 공용 비밀번호 입력 (화면에 표시되지 않음): ');
 const password=await rl.question('');process.stdout.write('\n');
 if(password.length<12||Buffer.byteLength(password,'utf8')>72)throw Error('비밀번호는 12자 이상, UTF-8 72바이트 이하로 입력하세요.');
 process.stdout.write('비밀번호 다시 입력: ');const confirm=await rl.question('');process.stdout.write('\n');if(password!==confirm)throw Error('비밀번호가 일치하지 않습니다.');
 console.log('WORKSPACE_PASSWORD_HASH='+await bcrypt.hash(password,12));
}catch(error){console.error(error.message);process.exitCode=1;}finally{rl.close();}
