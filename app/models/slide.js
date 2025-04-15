/**
 * The slide model extends from the basemodel
 */

import Basemodel from "./basemodel.js";


class Slide extends Basemodel{

    static collection = "slides";
    
    constructor(content, ...kwargs){
        super(...kwargs);
        this.content = content;
    }
}

export default Slide;