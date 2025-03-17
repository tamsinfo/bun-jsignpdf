import { tmpdir } from 'node:os';

export type PDFSignerOptions = {
	append?: boolean;
	bgPath?: string;
	bgScale?: number;
	contact?: string;
	certificationLevel?:
		| 'NOT_CERTIFIED'
		| 'CERTIFIED_NO_CHANGES_ALLOWED'
		| 'CERTIFIED_FORM_FILLING'
		| 'CERTIFIED_FORM_FILLING_AND_ANNOTATIONS';
	fontSize?: number;
	hashAlgorithm?: 'SHA1' | 'SHA256' | 'SHA384' | 'SHA512' | 'RIPEMD160';
	imgPath?: string;
	location?: string;
	signatureText?: string;
	statusText?: string;
	signatureBox?: [number, number, number, number]; // llx, lly, urx, ury
	pageNumber?: number | 'ALL';
	reason?: string;
	renderMode?:
		| 'DESCRIPTION_ONLY'
		| 'GRAPHIC_AND_DESCRIPTION'
		| 'SIGNAME_AND_DESCRIPTION';
	visible?: boolean;
};

export const signPdf = async (
	pdf: Buffer,
	p12: Buffer,
	options: PDFSignerOptions,
	pass?: string,
): Promise<Buffer> => {
	const dir = tmpdir();
	const uniq = `jsignpdf-${new Date().getTime()}`;
	const infile = `${dir}/${uniq}.pdf`;
	const outfile = infile.replace(/\.pdf$/, '_signed.pdf');
	const certfile = `${dir}/${uniq}.pfx`;

	Bun.write(infile, pdf.buffer)
	.then(() => {
		console.log("Successfully copied PDF to temporary directory.")
	})
	.catch((err) => {
		console.error("Error copying PDF to temporary directory:", err)
	});
	
	Bun.write(certfile, p12.buffer)
	.then(() => {
		console.log("Successfully copied PFX to temporary directory.")
	})
	.catch((err) => {
		console.error("Error copying PFX to temporary directory:", err)
	});

	// TODO: Make sure options.signatureBox is of correct format

	return new Promise((resolve, reject) => {
		const command =
			// biome-ignore format: Manual formatting is more readable here than Biome's formatting
			[
				'java',
				'-jar',
				'JSignPdf.jar',
				'--keystore-type', 'PKCS12',
				'--out-directory', dir,
				'--keystore-file', certfile,
				pass && '--keystore-pass', pass,
				options.append && '--append',
				options.visible && '--visible',
				options.bgPath && '--bg-path', options.bgPath,
				options.bgScale && '--bg-scale', options.bgScale,
				options.contact && '--contact', options.contact,
				options.certificationLevel && '--certification-level', options.certificationLevel,
				options.fontSize && '--font-size', options.fontSize,
				options.hashAlgorithm && '--hash-algorithm', options.hashAlgorithm,
				options.imgPath && '--img-path', options.imgPath,
				options.location && '--location', options.location,
				options.signatureText && '--l2-text', options.signatureText,
				options.statusText && '--l4-text', options.statusText,
				...(options.signatureBox ? [
					'-llx', options.signatureBox[0],
					'-lly', options.signatureBox[1],
					'-urx', options.signatureBox[2],
					'-ury', options.signatureBox[3],
				] : []),
				options.pageNumber && '--page', options.pageNumber,
				options.reason && '--reason', options.reason,
				options.renderMode && '--render-mode', options.renderMode,
				infile
			].filter(Boolean) as string[];

		Bun.spawn(command, {
			cwd: import.meta.dir.concat('/lib/jsignpdf-2.3.0'),
			onExit: (_subprocess, errorCode, _signalCode, error) => {
				if (error) {
					console.error(errorCode, error);
					reject(error);
					return;
				}

				Bun.file(outfile)
					.arrayBuffer()
					.then((arrayBuffer) => {
						resolve(Buffer.from(arrayBuffer));
					})
					.catch((err) => {
						reject(err);
					});
			},
		});
	});
};

export default signPdf;
