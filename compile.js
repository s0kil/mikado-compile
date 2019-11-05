#!/usr/bin/env node

const { html2json } = require("html2json");
const { readFileSync, writeFileSync, existsSync } = require("fs");

const parameter = parse_argv(process.argv, { force: 1, f: 1 });
const src = parameter.src || parameter.s || parameter[0];
let dest = parameter.dest || parameter.d || parameter[1];
const type = parameter.type || parameter.t || parameter[2];
const force = parameter.force || parameter.f || parameter[3];

function parse_argv(argv, flags){

    const payload = Object.create(null);
    let flag = "";
    let count = 0;

    for(let i = 2; i < argv.length; i++){

        const current = argv[i];

        if(current.indexOf("-") === 0){

            flag = current.replace(/-/g, "");

            if(flags[flag]){

                payload[flag] = true;
                flag = "";
            }
        }
        else{

            if(flag){

                payload[flag] = current;
                flag = "";
            }
            else{

                payload[count++] = current;
                payload.length = count;
            }
        }
    }

    return payload;
}

const event_types = {

    "tap": 1,
    "change": 1,
    "click": 1,
    "dblclick": 1,
    "input": 1,
    "keydown": 1,
    "keypress": 1,
    "keyup": 1,
    "mousedown": 1,
    "mouseenter": 1,
    "mouseleave": 1,
    "mousemove": 1,
    "mouseout": 1,
    "mouseover": 1,
    "mouseup": 1,
    "mousewheel": 1,
    "touchstart": 1,
    "touchmove": 1,
    "touchend": 1,
    "reset": 1,
    "select": 1,
    "submit": 1,
    "toggle": 1,
    "blur": 1,
    "error": 1,
    "focus": 1,
    "load": 1,
    "resize": 1,
    "scroll": 1
};

if(src){

    compile(src, dest, type);
}

module.exports = compile;

function stdin(query) {

    const readline = require("readline");

    const rl = readline.createInterface({

        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(function(resolve){

        rl.question(query, function(ans){

            rl.close();
            resolve(ans);
        })
    });
}

function create_filename(src, dest){

    if(dest){

        if(dest.lastIndexOf(".") !== -1){

            dest = dest.substring(0, dest.lastIndexOf("."));
        }
        else{

            if(src.lastIndexOf("/") !== -1){

                dest += src.substring(src.lastIndexOf("/") + 1, src.lastIndexOf("."));
            }
        }
    }
    else if(src.lastIndexOf(".") !== -1){

        dest = src.substring(0, src.lastIndexOf("."));
    }

    return dest;
}

async function compile(src, dest, type, _recall){

    if(!src){

        return;
    }

    if(type === "module") type = "es6";
    if(type === "js") type = "es5";

    if(!_recall){

        const glob = require("glob");
        const files = glob.sync(src);
        const types = type ? type.split(type.indexOf(",") !== 1 ? "," : "|") : ["es6", "es5", "json"];
        let exist = "";

        for(let i = 0; i < files.length; i++){

            for(let a = 0; a < types.length; a++){

                const type = types[a];
                const file = create_filename(files[i], dest) + (type === "es6" ? "." + type : "") + ".js";

                if(existsSync(file)){

                    exist += file + "\n"
                }
            }
        }

        if(exist && !force){

            const query = await stdin(exist + "\nThese files gets overwritten. Continue? (y/n): ");

            if(query !== "y"){

                return;
            }
        }

        for(let a = 0; a < types.length; a++){

            for(let i = 0; i < files.length; i++){

                await compile(files[i], dest, types[a], true);
            }
        }

        return;
    }

    dest = create_filename(src, dest);

    function remove_non_elemen_nodes(nodes){

        if(nodes.child){

            if(!nodes.child.length){

                delete nodes.child;
            }
            else{

                for(let i = 0; i < nodes.child.length; i++){

                    if(nodes.child[i].tag === "include"){

                        // if(nodes.child[i].attr && nodes.child[i].attr.for){
                        //
                        //     nodes.child[i].foreach = nodes.child[i].attr.for;
                        //
                        //     if(nodes.child[i].attr.max){
                        //
                        //         nodes.child[i]["max"] = nodes.child[i].attr.max;
                        //     }
                        // }

                        if(nodes.child[i].child){

                            // <include>{{ template }}</include>

                            // if(nodes.child[i].foreach){
                            //
                            //     nodes.child[i]["ref"] = nodes.child[i].child[0].text;
                            // }
                            // else{

                                nodes.child[i].include = nodes.child[i].child[0].text;
                            //}

                            delete nodes.child[i].child;
                        }
                        else{

                            // <include from="..."/>

                            // if(nodes.child[i].foreach){
                            //
                            //     nodes.child[i]["ref"] = nodes.child[i].attr.from;
                            // }
                            // else{

                                nodes.child[i].include = nodes.child[i].attr.from;
                            //}
                        }

                        delete nodes.child[i].tag;
                        delete nodes.child[i].attr;
                        delete nodes.child[i].node;

                        continue;
                    }

                    if(nodes.child[i].node === "text"){

                        delete nodes.child[i].node;

                        let text = nodes.child[i].text.replace(/\s+/g, " ")/*.trim()*/;

                        if(text.trim()){

                            if(text.indexOf("{{@") !== -1){

                                nodes.child[i].js = text.substring(text.indexOf("{{@") + 3, text.indexOf("}}", text.indexOf("{{@"))).trim();
                                delete nodes.child[i].text;

                                //nodes.child[i].node = "element";
                                text = text.substring(0, text.indexOf("{{@")) + text.substring(text.indexOf("}}", text.indexOf("{{@")) + 2);
                            }

                            if(text.trim()){

                                if(text.indexOf("{{#") !== -1){

                                    nodes.child[i].html = text.replace(/{{#/g, "{{");
                                    delete nodes.child[i].text;
                                }
                                else{

                                    nodes.child[i].text = text;
                                }
                            }
                            else if(!nodes.child[i].js){

                                nodes.child.splice(i--, 1);
                                continue;
                            }
                        }
                        else{

                            nodes.child.splice(i--, 1);
                            continue;
                        }

                        if((nodes.child.length === 1) && (!nodes.text || !nodes.child[i].text) && (!nodes.js || !nodes.child[i].js)){

                            if(nodes.child[i].text) nodes.text = nodes.child[i].text;
                            if(nodes.child[i].js) nodes.js = nodes.child[i].js;
                            if(nodes.child[i].html) nodes.html = nodes.child[i].html;
                            nodes.child = [];
                        }

                        continue;
                    }
                    else{

                        if(nodes.child[i].tag === "div"){

                            delete nodes.child[i].tag;
                        }

                        if(nodes.child[i].attr){

                            if(nodes.child[i].attr.class){

                                nodes.child[i].class = nodes.child[i].attr.class;

                                delete nodes.child[i].attr.class;

                                if(typeof nodes.child[i].class === "object"){

                                    nodes.child[i].class = nodes.child[i].class.join(" ")
                                }
                            }

                            if(nodes.child[i].attr.style){

                                // const styles = {};
                                // for(let a = 0; a < nodes.child[i].attr.style.length; a+=2){
                                //     styles[nodes.child[i].attr.style[a].replace(":", "")] = nodes.child[i].attr.style[a + 1].replace(";", "");
                                // }
                                //
                                // nodes.child[i].style = styles;
                                // delete nodes.child[i].attr.style;

                                nodes.child[i].style = nodes.child[i].attr.style;
                                delete nodes.child[i].attr.style;

                                if(typeof nodes.child[i].style === "object"){

                                    nodes.child[i].style = nodes.child[i].style.join(" ")
                                }
                            }

                            if(nodes.child[i].attr.if){

                                nodes.child[i].if = nodes.child[i].attr.if;
                                if(typeof nodes.child[i].if !== "string") nodes.child[i].if = nodes.child[i].if.join("");
                                delete nodes.child[i].attr.if;
                            }

                            // if(typeof nodes.child[i].attr.else !== "undefined"){
                            //
                            //     nodes.child[i].else = nodes.child[i].attr.else;
                            //     delete nodes.child[i].attr.else;
                            // }

                            // looped partial includes:
                            if(nodes.child[i].attr.include){

                                if(nodes.child[i].attr.for){

                                    //nodes.child[i].foreach = nodes.child[i].attr.for;
                                    nodes.child[i]["ref"] = nodes.child[i].attr.include;
                                    //delete nodes.child[i].attr.for;
                                }
                                else{

                                    nodes.child[i].child = [{
                                        node: "element",
                                        tag: "include",
                                        attr: {from: nodes.child[i].attr.include}
                                    }];
                                    //nodes.child[i].include = nodes.child[i].attr.include;
                                }

                                delete nodes.child[i].attr.include;
                            }

                            // inline loops:
                            // TODO: label has "for" attribute
                            if(nodes.child[i].attr.for && (nodes.child[i].tag !== "label")){

                                nodes.child[i].foreach = nodes.child[i].attr.for;
                                delete nodes.child[i].attr.for;
                            }

                            if(nodes.child[i].attr.max){

                                nodes.child[i]["max"] = nodes.child[i].attr.max;
                                delete nodes.child[i].attr.max;
                            }

                            let text = nodes.child[i].attr.js;

                            if(text){

                                if(typeof text !== "string") text = text.join(" ");

                                nodes.child[i].js = text.replace(/{{/g, "").replace(/}}/g, "").trim();
                                delete nodes.child[i].attr.js;
                            }

                            if(nodes.child[i].attr.key){

                                nodes.child[i]["key"] = nodes.child[i].attr.key.replace("data.", "");
                                delete nodes.child[i].attr.key;
                            }

                            if(nodes.child[i].attr.bind){

                                if(typeof nodes.child[i].attr.bind !== "string") nodes.child[i].attr.bind = nodes.child[i].attr.bind.join("");

                                const parts = nodes.child[i].attr.bind.split(":");
                                if(parts.length < 2) parts.unshift("value");

                                nodes.child[i].attr[parts[0]] = "{{==" + parts[1] + "}}";
                                //nodes.child[i].attr.bind = parts;
                                //delete nodes.child[i].attr.bind;
                            }

                            const keys = Object.keys(nodes.child[i].attr);

                            if(keys.length === 0){

                                delete nodes.child[i].attr;
                            }
                            else{

                                let removes = 0;

                                for(let x = 0; x < keys.length; x++){

                                    if(typeof nodes.child[i].attr[keys[x]] === "object"){

                                        nodes.child[i].attr[keys[x]] = nodes.child[i].attr[keys[x]].join(" ");
                                    }

                                    if(!event_types[keys[x]] && event_types[keys[x].substring(2)] && (nodes.child[i].attr[keys[x]].indexOf("{{") !== -1)){

                                        event_types[keys[x].substring(2)] = event_types[keys[x]];
                                        delete event_types[keys[x]];
                                    }

                                    if(event_types[keys[x]]){

                                        nodes.child[i]["event"] || (nodes.child[i]["event"] = {});
                                        nodes.child[i]["event"][keys[x]] = nodes.child[i].attr[keys[x]];
                                        delete nodes.child[i].attr[keys[x]];
                                        removes++;
                                    }
                                }

                                if(removes === keys.length){

                                    delete nodes.child[i].attr;
                                }
                            }
                        }
                    }

                    if(!nodes.child[i].node){

                        nodes.child.splice(i, 1);
                        i--;
                    }
                    else{

                        delete nodes.child[i].node;

                        remove_non_elemen_nodes(nodes.child[i]);
                    }
                }

                if(nodes.child.length === 0){

                    delete nodes.child;
                }
                /*
                else if(nodes.node === "root" && nodes.child.length === 1){

                    nodes = nodes.child[0];
                }
                */
                else if(nodes.child.length === 1){

                    nodes.child = nodes.child[0];
                }

                // looped template root:
                // TODO: label has "for" attribute
                if(nodes.for && (nodes.tag !== "label") && !nodes.include){

                    nodes.foreach = nodes.for;
                    nodes["ref"] = nodes.child;
                    delete nodes.child;
                    delete nodes.for;
                }

                if(typeof nodes.foreach === "object"){

                    nodes.foreach = nodes.foreach.join(" ")
                }

                if(nodes.include && nodes.include.length === 1){

                    nodes.include = nodes.include[0];
                }
            }
        }

        // if(nodes.node === "root"){
        //
        //     delete nodes.node;
        // }

        return nodes;
    }

    //console.log(html2json(template).child[0].child[1].child[0].text.replace(/\s+/g, ' ').trim());
    const template = readFileSync(__dirname + "/../../" + src, "utf8").replace(/<!--[\s\S]*?-->/g, "");

    let is_static = true;
    let json = remove_non_elemen_nodes(html2json(template));

    function create_schema(root){

        if(root){

            if(root.constructor === Array){

                for(let i = 0; i < root.length; i++){

                    create_schema(root[i]);
                }
            }
            else if(root.constructor === Object){

                for(let key in root){

                    if(root.hasOwnProperty(key)){

                        const value = root[key];

                        if(typeof value === "string"){

                            const bind = value.indexOf("{{==") !== -1;
                            const proxy = bind || value.indexOf("{{=") !== -1;

                            if(value.indexOf("{{") !== -1 && value.indexOf("}}") !== -1){

                                is_static = false;

                                const tmp = value.replace(/{{==/g, "{{")
                                                 .replace(/{{=/g, "{{")
                                                 .replace(/"{{/g, "")
                                                 .replace(/}}"/g, "")
                                                 .replace(/{{/g, "' + ")
                                                 .replace(/}}/g, " + '");

                                root[key] = [("'" + tmp + "'").replace(/'' \+ /g, "")
                                                              .replace(/ \+ ''/g, "")
                                                              .trim()];

                                if(bind){

                                    root[key].push(2);
                                }
                                else if(proxy){

                                    root[key].push(1);
                                }
                            }
                        }
                        else{

                            create_schema(value);
                        }
                    }
                }
            }
        }
    }

    let template_name = dest;

    if(template_name.lastIndexOf("/") !== -1){

        template_name = template_name.substring(template_name.lastIndexOf("/") + 1);
    }

    if(json) create_schema(json);
    if(json) json = json.child.length ? json.child[0] : json.child;
    if(json){
        json.static = is_static;
        json.name = template_name;
        json.version = require("./package.json").version;
    }
    if(json) json = type === "json" ? JSON.stringify(json) : JSON.stringify(json, null, 2);

    json = json.replace(/"name":/g, "\"n\":")
               .replace(/"version":/g, "\"v\":")
               .replace(/"static":/g, "\"d\":")
               .replace(/"tag":/g, "\"t\":")
               .replace(/"attr":/g, "\"a\":")
               .replace(/"class":/g, "\"c\":")
               .replace(/"text":/g, "\"x\":")
               .replace(/"html":/g, "\"h\":")
               .replace(/"style":/g, "\"s\":")
               .replace(/"css":/g, "\"p\":")
               .replace(/"child":/g, "\"i\":")
               .replace(/"js":/g, "\"j\":")
               .replace(/"event":/g, "\"e\":")
               .replace(/"include":/g, "\"+\":")
               .replace(/"ref":/g, "\"@\":")
               .replace(/"foreach":/g, "\"r\":")
               .replace(/"max":/g, "\"m\":")
               .replace(/"if":/g, "\"f\":")
               .replace(/"key":/g, "\"k\":");
    //.replace(/"else":/g, "\"e\":")
    //.replace(/"bind":/g, "\"b\":")
    //.replace(/"type":/g, "\"y\":")
    //.replace(/"value":/g, "\"u\":")

    if(!type || (type === "json")) writeFileSync(__dirname + '/../../' + (dest || src) + '.json', json, 'utf8');
    if(type === "json") return json;

    /*
    json = json.replace(/"tag":/g, "tag:")
               .replace(/"attr":/g, "attr:")
               .replace(/"class":/g, "class:")
               .replace(/"text":/g, "text:")
               .replace(/"html":/g, "html:")
               .replace(/"style":/g, "style:")
               .replace(/"css":/g, "css:")
               .replace(/"child":/g, "child:");
               .replace(/"{{/g, "")
               .replace(/}}"/g, "")
               .replace(/{{/g, "\" + ")
               .replace(/}}/g, " + \"");
    */

    const es5 = "Mikado.register(" + json + ");";
    if(!type || (type === "es5")) writeFileSync(__dirname + '/../../' + (dest || src) + '.js', es5, 'utf8');
    if(type === "es5") return es5;

    const es6 = "export default " + json + ";";
    if(!type || (type === "es6")) writeFileSync(__dirname + '/../../' + (dest || src) + '.es6.js', es6, 'utf8');
    if(type === "es6") return es6;
}