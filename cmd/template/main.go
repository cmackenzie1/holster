package main

import (
	"bytes"
	"flag"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"
	"text/template"
)

type tpl struct {
	WorkerName   string
	UseCustomDomain bool
}

func main() {
	workerName := flag.String("name", "hello-world", "Name of the Worker")
	customDomain := flag.Bool("customdomain", false, "Create a subdomain to host the Worker under")
	templateDir := flag.String("template", "", "Path to the template to use.")
	flag.Parse()

	if *templateDir == "" {
		*templateDir = filepath.Join("./", ".templates", "{{ .WorkerName }}")
	}

	templateData := tpl{
		WorkerName:      *workerName,
		UseCustomDomain: *customDomain,
	}

	srcTplPath, err := filepath.Abs(*templateDir)
	if err != nil {
		log.Fatalf("unable to locate templates: %v", err)
	}
	log.Printf("templates src: %s", srcTplPath)

	// ./workers/{{ .WorkerName }}, values replaced
	strings.Split(srcTplPath, "/")

	dstRootPath := filepath.Join("./workers", templateString(filepath.Base(srcTplPath), templateData))
	dstRootPath, err = filepath.Abs(dstRootPath)
	if err != nil {
		log.Fatalf("invalid destination: %v", err)
	}

	files, err := listFiles(srcTplPath)
	if err != nil {
		log.Fatalf("unable to list template src files: %v", err)
	}
	log.Printf("src files:\n   - %s", strings.Join(files, "\n   - "))

	log.Printf("destination dir: %q", dstRootPath)
	for _, srcPath := range files {
		dstPath := filepath.Join(dstRootPath, strings.TrimPrefix(srcPath, srcTplPath))
		// create the directory, replacing any template strings with the values
		if ok, _ := isDirectory(srcPath); ok {
			mkdir(dstPath)
			log.Printf("created dir: %s", dstPath)
		} else { // create file from src template
			mkdir(filepath.Dir(dstPath)) // ensure the parent dir(s) exist
			if err := templateFile(srcPath, dstPath, templateData); err != nil {
				log.Fatalf("unable to template file: %v", err)
			}
			log.Printf("created file: %s", dstPath)
		}
	}
}

// isDirectory determines if a file represented
// by `path` is a directory or not
func isDirectory(path string) (bool, error) {
	fileInfo, err := os.Stat(path)
	if err != nil {
		return false, err
	}

	return fileInfo.IsDir(), err
}

func templateString(tpl string, data any) string {
	buf := &bytes.Buffer{}
	t := template.Must(template.New("").Parse(tpl))
	t.Execute(buf, data)
	return buf.String()
}

func templateFile(tplSrcPath string, dstPath string, data any) error {
	buf := &bytes.Buffer{}
	t := template.Must(template.ParseFiles(tplSrcPath))
	err := t.Execute(buf, data)
	if err != nil {
		return err
	}
	return os.WriteFile(dstPath, buf.Bytes(), os.ModePerm)
}

func mkdir(path string) error {
	return os.MkdirAll(path, os.ModePerm)
}

func listFiles(path string) ([]string, error) {
	files := []string{}
	if err := filepath.Walk(path, func(path string, info fs.FileInfo, err error) error {
		files = append(files, path)
		return nil
	}); err != nil {
		return []string{}, err
	}
	return files, nil
}
