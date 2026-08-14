export namespace main {
	
	export class FileInfo {
	    Name: string;
	    Size: number;
	    ModTime: string;
	
	    static createFrom(source: any = {}) {
	        return new FileInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Name = source["Name"];
	        this.Size = source["Size"];
	        this.ModTime = source["ModTime"];
	    }
	}
	export class ReadResult {
	    Content: string;
	    Encoding: string;
	
	    static createFrom(source: any = {}) {
	        return new ReadResult(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.Content = source["Content"];
	        this.Encoding = source["Encoding"];
	    }
	}

}

