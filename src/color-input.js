export function frameLatest(apply,schedule=callback=>requestAnimationFrame(callback),cancel=id=>cancelAnimationFrame(id)) {
 let frame=null,latest
 function run(){const value=latest;frame=null;latest=undefined;apply(value)}
 function input(value){latest=value;if(frame===null)frame=schedule(run)}
 input.flush=()=>{if(frame!==null){cancel(frame);run()}}
 input.cancel=()=>{if(frame!==null)cancel(frame);frame=null;latest=undefined}
 return input
}
