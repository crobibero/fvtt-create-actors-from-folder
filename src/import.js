Hooks.on("getActorDirectoryFolderContext", (html, list) => {
    list.push({
        name: "Import Actors from folder",
        icon: "<i class='fas fa-user-friends'></i>",
        callback: async dir => {
            let dirId = dir.parent().attr("data-folder-id");
            await ActorImporter.Prompt(dirId);
        }
    })
})

class ActorImporter {
    /**
     * Prompt for target path
     */
    static async Prompt(parentDirId) {
        new Dialog({
            title: 'Actor Import',
            content: `/data/<input type="text" name="importTarget"></input>`,
            buttons: {
                confirm: {
                    label: "Select",
                    callback: async html => this.Prompt2(parentDirId, html.find('[name=importTarget]').val())
                },
                cancel: {
                    label: "Cancel"
                }
            },
            default: "confirm"
        }).render(true);
    }

    /**
     * Confirm target path
     */
    static async Prompt2(parentDirId, target){
        const source = 'data';
        let browseResult = await FilePicker.browse(source, target);

        const dirs = browseResult.dirs.slice(0, 10);
        let html = '<div>';
        for(const dir of dirs){
            html += `<p>${dir}</p>`
        }
        html += '<p>...</p></div>'

        new Dialog({
            title: 'Actor Import Confirmation',
            content: html,
            buttons: {
                confirm: {
                    label: "Confirm",
                    callback: async html => this.Import(parentDirId, source, target)
                },
                cancel: {
                    label: "Cancel"
                }
            },
            default: "confirm"
        }).render(true);

    }

    /**
     * Begin import
     */
    static async Import(parentDirId, source, target){
        console.log(parentDirId);
        /**
         * Recursivly get all images
         */
        const Browse = async (base, target, directories, files) => {
            let browseResult = await FilePicker.browse(base, target);
        
            for(const dir of browseResult.dirs){
                const dirName = dir.split('/').pop();
                const dirIndex = GetDirectoryIndex(directories, dirName)
    
                if(dirIndex < 0){
                    directories.push({
                        Name: dirName,
                        Id: null,
                        TokenCount: 0
                    });
                }

                /* Browse current directory */
                await Browse(base, dir, directories, files);
            }

            const fileParent = target.split('/').pop();
            for(const file of browseResult.files){
                const fileLower = file.toLowerCase();
                if(fileLower.endsWith('.jpg') || fileLower.endsWith('.png')){
                    const fileName = file.split('/').pop();
                    files.push({
                        Name: fileName.substring(0, fileName.lastIndexOf('.')),
                        Parent: fileParent,
                        Path: file
                    });       
                    
                    const dirIndex = GetDirectoryIndex(directories, fileParent);
                    directories[dirIndex].TokenCount++;
                }
            }
        }

        const GetDirectoryIndex = (directories, name) => {
            name = name.toLowerCase();
            let dirIndex = directories.findIndex(d => d.Name.toLowerCase() === name);
            // if directory not found, set to first parent
            if(dirIndex < 0) dirIndex = 0;
            return dirIndex;
        }

        const directories = [];
        const files = [];

        /* add current folder to folders */
        var parentDir = game.folders.get(parentDirId);
        directories.push({
            Name: parentDir.data.name,
            Id: parentDirId,
            TokenCount: 0
        });

        await Browse(source, target, directories, files);

        ui.notifications.info(`Import starting...`);

        console.log(directories);
        console.log(files);

        for(const directory of directories.filter(d => d.TokenCount > 0)){
            if(directory.Id === null || directory.Id === undefined){
                const createdFolder = await Folder.create({
                    name: directory.Name,
                    parent: parentDirId,
                    type: "Actor"
                });

                directory.Id = createdFolder.data._id;
            }
        }

        for(const file of files){
            const dirIndex = GetDirectoryIndex(directories, file.Parent);
            await Actor.create({
                name: decodeURIComponent(file.Name),
                type: "character",
                img: file.Path,
                folder: directories[dirIndex].Id
            })
        }

        ui.notifications.info(`Import Complete. Imported ${files.length} actors.`);
    }
}